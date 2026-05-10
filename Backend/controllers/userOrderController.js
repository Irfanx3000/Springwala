const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const delhiveryService = require('../services/delhiveryService');

const generateOrderNumber = async () => {
  const count = await Order.countDocuments();
  return `SW${String(count + 1).padStart(6, "0")}`;
};

// --- Shipping Provider Integration (Provider-Agnostic) ---
// TODO: Replace this with real Delhivery API call when keys are provided
async function getShippingRate({ pincode, weight }) {
  try {
    // 🚧 Placeholder for future provider integration
    console.log("[SHIPPING PROVIDER] No API connected, skipping...");
    return null;
  } catch (err) {
    console.error("[SHIPPING ERROR]", err.message);
    return null;
  }
}

// --- Hybrid Delivery Logic (SSOT) ---
const getDeliveryCharges = async ({ totalAmount, pincode, weight }) => {
  try {
    const DEFAULT_CHARGE = Number(process.env.DEFAULT_SHIPPING_CHARGE || 120);
    const THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 1000);

    // 1. Try real Delhivery Rate API
    const estimate = await delhiveryService.getShippingEstimate({
      pincode,
      weight: weight * 1000, // convert kg to grams for API
      paymentMode: 'Prepaid', // Default for estimation
      totalAmount
    });

    if (estimate && estimate.success) {
      console.log(`[DELHIVERY RATE SUCCESS] Charge: ${estimate.deliveryCharge}`);
      return estimate.deliveryCharge;
    }

    // 2. Fallback to Environment Rules if API fails or pincode unserviceable
    console.log(`[SHIPPING FALLBACK USED] Total: ${totalAmount}, Threshold: ${THRESHOLD}`);
    return totalAmount >= THRESHOLD ? 0 : DEFAULT_CHARGE;
  } catch (err) {
    console.error(`[SHIPPING ERROR] Fallback triggered:`, err.message);
    const DEFAULT_CHARGE = Number(process.env.DEFAULT_SHIPPING_CHARGE || 120);
    const THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 1000);
    return totalAmount >= THRESHOLD ? 0 : DEFAULT_CHARGE;
  }
};

// --- Integrated Shipment System (REMOVED: Manual Flow Only) ---
// Admin must manually trigger shipment from dashboard for Online orders.

// --- Pricing Single Source of Truth (SSOT) ---
const PricingEngine = require('../utils/pricingEngine');

const calculatePricing = async (bodyItems, pincode) => {
  console.log('[PRICING ENGINE] Initializing calculation for items:', JSON.stringify(bodyItems));

  if (!bodyItems || !Array.isArray(bodyItems)) {
    throw new Error('Invalid items format. Expected an array of cart items.');
  }

  let subtotal = 0;
  let totalUnits = 0;
  let totalWeight = 0;
  const validatedItems = [];

  for (let i = 0; i < bodyItems.length; i++) {
    const item = bodyItems[i];
    
    // Normalize Product Identifier (Support product, productId, _id)
    const productIdentifier = item.product || item.productId || item._id;
    if (!productIdentifier) {
      console.warn(`[PRICING ENGINE] Skipping item at index ${i} - missing product identifier.`);
      continue;
    }

    const product = await Product.findById(productIdentifier);
    if (!product) {
      console.warn(`[PRICING ENGINE] Skipping item ${productIdentifier} - not found in database.`);
      continue;
    }
    if (!product.isActive) {
      console.warn(`[PRICING ENGINE] Skipping item ${product.name} - product is inactive.`);
      continue;
    }

    // Determine batch if specified
    let selectedBatch = null;
    const batchQty = Number(item.batchQuantity || 1);
    if (batchQty > 1 && product.batches) {
      selectedBatch = product.batches.find(b => Number(b.quantity) === batchQty);
    }

    // Call Centralized Pricing Engine
    const calc = PricingEngine.calculateCartItem({
      product,
      quantity: Number(item.quantity || 1),
      selectedBatch: selectedBatch || item.selectedBatch
    });

    const validatedItem = {
      product: product._id,
      productId: product._id, // Mirror for safety
      name: product.name,
      image: item.image || (product.images && product.images[0]) || '',
      quantity: Number(item.quantity || 1),
      finalPrice: calc.displayPrice, 
      subtotal: calc.subtotal,
      total: calc.subtotal,
      hsn: calc.hsn || product.hsnCode || '',
      
      // Snapshots for Invoice & Admin
      isBatchProduct: calc.isBatchProduct,
      batchQuantity: calc.batchQuantity,
      batchPrice: calc.batchPrice,
      unitPrice: calc.unitPrice,
      basePrice: calc.baseUnitPrice,
      discountPercent: calc.discountPercent,
      gstPercent: calc.gstPercent,
      weight: calc.deliveryEligibleWeight / calc.totalUnits,
      totalUnits: calc.totalUnits,
      selectedBatch: calc.selectedBatch,
      gstAmount: calc.gstAmount,
      totalWithoutGst: calc.totalWithoutGst
    };

    console.log(`[PRICING] Item: ${product.name} | Batch: ${calc.isBatchProduct} | Price: ${calc.displayPrice} | Subtotal: ${calc.subtotal}`);

    validatedItems.push(validatedItem);
    subtotal += calc.subtotal;
    totalUnits += calc.totalUnits;
    totalWeight += calc.deliveryEligibleWeight;
  }

  if (validatedItems.length === 0) {
    throw new Error('No valid items found in cart. All products may be unavailable or deleted.');
  }

  // Delivery Charges calculation
  let deliveryCharges = await getDeliveryCharges({
    totalAmount: subtotal,
    pincode,
    weight: totalWeight
  });

  if (!deliveryCharges || isNaN(deliveryCharges)) deliveryCharges = 0;

  const finalAmount = subtotal + deliveryCharges;

  console.log(`[PRICING SUMMARY] Subtotal: ${subtotal}, Delivery: ${deliveryCharges}, Final: ${finalAmount}`);

  return {
    items: validatedItems,
    totalAmount: subtotal,
    deliveryCharges,
    finalAmount,
    totalWeight,
    totalUnits
  };
};

exports.calculatePricing = calculatePricing;


// ─── POST /api/user/orders ────────────────────────────────────────────────────
exports.placeOrder = async (req, res) => {
  try {
    const { items: bodyItems, shippingAddress, paymentMethod = 'COD', notes } = req.body;

    // 1. Validation
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.pincode) {
      return res.status(400).json({ success: false, message: 'Complete shipping address is required.' });
    }
    if (!bodyItems || !bodyItems.length) {
      return res.status(400).json({ success: false, message: 'Order items are required.' });
    }

    // 2. Server-side calculation & Stock check (SSOT)
    const pincode = shippingAddress.pincode;
    const pricing = await calculatePricing(bodyItems, pincode);

    // Stock check on verified items
    for (const item of pricing.items) {
      const p = await Product.findById(item.product).select('stock name isActive');
      if (!p || !p.isActive) {
        return res.status(400).json({ success: false, message: `Product "${item.name}" is no longer available.` });
      }
      if (p.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${p.name}".` });
      }
    }

    const { totalAmount, deliveryCharges, finalAmount, items: validatedItems, totalWeight, totalUnits } = pricing;
    console.log(`[DELIVERY] Total: ${totalAmount}, Delivery: ${deliveryCharges}, Final: ${finalAmount}`);

    // 3. Generate Unique Order Number
    const orderNumber = await generateOrderNumber();

    // 4. Create Order
    const user = await User.findById(req.user._id);
    let order = await Order.create({
      orderNumber,
      user: req.user._id,
      customerName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown Customer',
      items: validatedItems,
      shippingAddress,
      subtotal: totalAmount, 
      gstAmount: validatedItems.reduce((sum, i) => sum + (i.gstAmount || 0), 0),
      shippingCharge: deliveryCharges,
      deliveryCharges: deliveryCharges,
      totalAmount: totalAmount, // Items Total
      finalAmount: finalAmount, // Grand Total
      totalUnits,
      totalWeight,
      paymentMethod,
      paymentStatus: req.body.paymentStatus || 'Pending',
      paymentDetails: req.body.paymentDetails || {},
      orderStatus: 'Ordered',
      notes: notes || '',
      statusHistory: [{ status: 'Ordered', updatedBy: 'User', note: req.body.paymentStatus === 'Completed' ? 'Order placed & Paid online' : 'Order placed' }]
    });

    // ─── GENERATE SHIPMENT (REMOVED: Manual Admin Workflow Only) ───
    // Shipment is no longer auto-created on placement.
    // Admin reviews paid orders and clicks 'Create Shipment' in Dashboard.

    // ─── Generate Invoice & Email ───
    const generateInvoice = require('../utils/generateInvoice');
    const { sendOrderConfirmationEmail } = require('../services/emailService');

    let invoicePath = null;
    try {
      invoicePath = await generateInvoice(order);
      if (invoicePath) {
        order.invoiceUrl = invoicePath;
        await order.save();
      }
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }

    // Send email asynchronously if invoice exists
    if (invoicePath && user && user.email) {
      sendOrderConfirmationEmail({
        email: user.email,
        name: user.firstName,
        order: order,
        invoicePath: invoicePath
      }).catch(err => console.error('Email confirmation error:', err));
    }

    // 5. Post-Order Actions (Stock & Stats)
    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity, totalSold: item.quantity },
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalOrders: 1, totalSpent: totalAmount },
    });

    res.status(201).json({ 
      success: true, 
      message: 'Order placed successfully', 
      orderId: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      tracking: {
        awb: order.awb,
        url: order.trackingUrl
      }
    });
  } catch (err) {
    console.error('placeOrder error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/user/orders ─────────────────────────────────────────────────────
// Protected. Returns logged-in user's orders with pagination
exports.getMyOrders = async (req, res) => {
  try {
    const { orderStatus, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };
    if (orderStatus) query.orderStatus = orderStatus;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.product', 'name images slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      orders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/user/orders/:id ─────────────────────────────────────────────────
// Protected. Single order — user can only view their own orders
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .populate('items.product', 'name images basePrice finalPrice slug');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/user/orders/:id/cancel ────────────────────────────────────────
// Protected. User can cancel only Pending or Ordered status orders
exports.cancelOrder = async (req, res) => {
  try {
    const { cancelReason } = req.body;

    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const cancellable = ['Pending', 'Ordered'];
    if (!cancellable.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order with status "${order.orderStatus}". Please contact support.`,
      });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, totalSold: -item.quantity },
      });
    }

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalOrders: -1, totalSpent: -order.totalAmount },
    });

    order.orderStatus = 'Cancelled';
    order.cancelReason = cancelReason || 'Cancelled by user';
    order.statusHistory.push({
      status: 'Cancelled',
      updatedBy: 'User',
      note: cancelReason || 'Cancelled by user',
    });
    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully.', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/user/orders/summary ───────────────────────────────────────────
exports.getOrderSummary = async (req, res) => {
  try {
    const { items: bodyItems, pincode } = req.body;
    
    console.log('[SUMMARY REQUEST] Items count:', bodyItems?.length, 'Pincode:', pincode);

    if (!bodyItems || !bodyItems.length) {
      return res.json({ success: true, totalAmount: 0, deliveryCharges: 0, finalAmount: 0 });
    }

    const pricing = await calculatePricing(bodyItems, pincode);

    console.log('[SUMMARY SUCCESS] Total:', pricing.finalAmount, 'Items:', pricing.items?.length);

    res.json({
      success: true,
      items: pricing.items,
      totalAmount: pricing.totalAmount,
      deliveryCharges: pricing.deliveryCharges,
      finalAmount: pricing.finalAmount,
      totalWeight: pricing.totalWeight,
      totalUnits: pricing.totalUnits
    });
  } catch (err) {
    console.error('[SUMMARY CRITICAL ERROR]', err);
    // Even on error, try to return a safe response if possible or a clear message
    res.status(500).json({ 
      success: false, 
      message: 'Order summary calculation failed. This might be due to invalid product data or cart corruption.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


// ─── GET /api/user/orders/track/:awb ─────────────────────────────────────────
exports.trackOrder = async (req, res) => {
  try {
    const { awb } = req.params;
    const order = await Order.findOne({ awb }).select('awb shipmentStatus orderStatus customerName createdAt updatedAt trackingUrl courier');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Tracking information not found for this ID.' });
    }

    let scans = [];
    let expectedDelivery = null;

    // Fetch live tracking if it's a Delhivery shipment
    if (order.awb || order.waybill) {
      const liveTracking = await delhiveryService.trackShipment(order.awb || order.waybill);
      if (liveTracking.success) {
        scans = liveTracking.scans || [];
        expectedDelivery = liveTracking.expectedDeliveryDate;
        
        // Sync status if it's different
        const mappedStatus = delhiveryService.mapStatus(liveTracking.status);
        if (mappedStatus && mappedStatus !== order.shipmentStatus) {
          order.shipmentStatus = mappedStatus;
          await order.save();
        }
      }
    }

    res.json({
      success: true,
      tracking: {
        awb: order.awb,
        status: order.shipmentStatus,
        orderStatus: order.orderStatus,
        customer: order.customerName,
        placedAt: order.createdAt,
        lastUpdated: order.updatedAt,
        scans: scans,
        expectedDelivery: expectedDelivery,
        trackingUrl: order.trackingUrl,
        courier: order.courier || 'Delhivery'
      }
    });
  } catch (err) {
    console.error('[TRACK ORDER ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
