const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
// const delhiveryService = require('../services/delhiveryService');

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
    if (!pincode || pincode.length < 6) {
      return { charge: 0, serviceable: true, message: "Enter pincode for shipping estimate", isPending: true };
    }

    // ─── TEMPORARY MANUAL SHIPPING MODE ───
    console.log(`[ORDER-SYNC] Calculating shipping for Pincode: ${pincode}, Subtotal: ${totalAmount}`);

    let manualCharge = 350; // Default Standard
    const prefix = pincode.substring(0, 3);
    const statePrefix = pincode.substring(0, 2);

    if (prefix === '400' || prefix === '401') {
      manualCharge = 79; // Local Mumbai/Thane
    } else if (statePrefix === '40' || statePrefix === '41' || statePrefix === '42' || statePrefix === '43' || statePrefix === '44') {
      manualCharge = 199; // Maharashtra Regional
    } else {
      manualCharge = 350; // National
    }

    // Check for Free Shipping Override (Business Logic)
    const THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 1500);
    const finalCharge = totalAmount >= THRESHOLD ? 0 : manualCharge;

    console.log(`[ORDER-SYNC] Shipping Result: ₹${finalCharge} (Threshold: ₹${THRESHOLD})`);

    return {
      charge: finalCharge,
      serviceable: true,
      courier: "Manual Fulfillment",
      message: totalAmount >= THRESHOLD ? "Free delivery applied!" : `Manual Shipping: ₹${finalCharge}`,
      isManual: true
    };
  } catch (err) {
    console.error(`[ORDER-SYNC] SHIPPING CRITICAL ERROR:`, err.message);
    return { charge: 150, serviceable: true, message: "Standard Shipping Applied" };
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
  const delivery = await getDeliveryCharges({
    totalAmount: subtotal,
    pincode,
    weight: totalWeight
  });

  const deliveryCharges = delivery.charge;
  const finalAmount = Number((subtotal + deliveryCharges).toFixed(2));

  console.log(`[ORDER-SYNC] FINAL CALCULATION - Subtotal: ${subtotal}, Shipping: ${deliveryCharges}, Grand Total: ${finalAmount}`);

  return {
    items: validatedItems,
    subtotal: Number(subtotal.toFixed(2)),
    shippingCharge: deliveryCharges,
    totalAmount: finalAmount, // Standardize on totalAmount as Grand Total
    finalAmount: finalAmount, // Mirror for compatibility
    totalWeight,
    totalUnits,
    shippingInfo: delivery
  };
};

exports.calculatePricing = calculatePricing;


// ─── POST /api/user/orders ────────────────────────────────────────────────────
exports.placeOrder = async (req, res) => {
  try {
    const { items: bodyItems, shippingAddress, paymentMethod = 'Online', notes } = req.body;

    // ─── TEMPORARY FALLBACK: ONLINE ONLY ───
    if (paymentMethod === 'COD') {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is temporarily disabled. Please use Online Payment.' });
    }

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

    const { subtotal, shippingCharge, totalAmount: grandTotal, items: validatedItems, totalWeight, totalUnits, shippingInfo } = pricing;

    // Task 6: Final Serviceability Guard
    if (shippingInfo && !shippingInfo.serviceable) {
      return res.status(400).json({ success: false, message: shippingInfo.message || 'This pincode is currently not serviceable.' });
    }

    console.log(`[ORDER-SYNC] Creating Order: Subtotal=${subtotal}, Shipping=${shippingCharge}, GrandTotal=${grandTotal}`);

    // 3. Generate Unique Order Number
    const orderNumber = await generateOrderNumber();

    // 4. Create Order with Internal Tracking ID
    const user = await User.findById(req.user._id);
    const trackingNumber = `SW-TRK-${orderNumber.replace('SW', '')}`; // e.g. SW-TRK-000001
    
    let order = await Order.create({
      orderNumber,
      trackingNumber, // [TRACKING-SYNC] Internal ID for manual fulfillment
      user: req.user._id,
      customerName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown Customer',
      items: validatedItems,
      shippingAddress,
      subtotal: subtotal,
      gstAmount: validatedItems.reduce((sum, i) => sum + (i.gstAmount || 0), 0),
      shippingCharge: shippingCharge,
      deliveryCharges: shippingCharge,
      totalAmount: grandTotal, // Grand Total (Items + Shipping)
      finalAmount: grandTotal,
      totalUnits,
      totalWeight,
      paymentMethod,
      paymentStatus: req.body.paymentStatus || 'Pending',
      paymentDetails: req.body.paymentDetails || {},
      orderStatus: 'Pending',
      notes: notes || '',
      courier: 'Manual Fulfillment',
      shippingProvider: 'Manual',
      estimatedDelivery: shippingInfo?.estimatedDays || '3-7 Business Days',
      shippingEstimate: shippingInfo,
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
        awb: order.awb || order.trackingNumber || order.orderNumber,
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
      subtotal: pricing.subtotal,
      shippingCharge: pricing.shippingCharge,
      totalAmount: pricing.totalAmount,
      finalAmount: pricing.finalAmount,
      totalWeight: pricing.totalWeight,
      totalUnits: pricing.totalUnits,
      shippingInfo: pricing.shippingInfo
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


// ─── GET /api/user/orders/track/:identifier ─────────────────────────────────
exports.trackOrder = async (req, res) => {
  try {
    const identifier = (req.params.identifier || '').trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Tracking identifier is required.' });
    }

    // Support tracking ONLY by trackingNumber (SSOT), orderNumber, or _id
    const order = await Order.findOne({
      $or: [
        { trackingNumber: identifier },
        { orderNumber: identifier },
        { _id: identifier.match(/^[0-9a-fA-F]{24}$/) ? identifier : null }
      ]
    })
    .populate('items.product', 'name images')
    .select('trackingNumber orderNumber orderStatus customerName createdAt updatedAt courier statusHistory items');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Tracking information not found for this ID.' });
    }

    // Use internal status history as scans for manual tracking (PURE MANUAL MODE)
    const scans = (order.statusHistory || []).map(h => ({
      status: h.status,
      location: 'Warehouse',
      time: h.timestamp || h.createdAt,
      instructions: h.note || `Order status updated to ${h.status}`
    }));

    res.json({
      success: true,
      tracking: {
        trackingNumber: order.trackingNumber,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        orderStatus: order.orderStatus,
        customer: order.customerName,
        placedAt: order.createdAt,
        lastUpdated: order.updatedAt,
        scans: scans,
        items: order.items,
        courier: order.courier || 'Manual Fulfillment'
      }
    });
  } catch (err) {
    console.error('[TRACK ORDER ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/user/orders/:id/track ──────────────────────────────────────────
exports.trackOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user?._id })
      .select('trackingNumber orderNumber orderStatus customerName createdAt updatedAt courier statusHistory');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const scans = (order.statusHistory || []).map(h => ({
      status: h.status,
      location: 'Warehouse',
      time: h.updatedAt || h.timestamp || h.createdAt,
      instructions: h.note || `Order status updated to ${h.status}`
    }));

    res.json({
      success: true,
      tracking: {
        trackingNumber: order.trackingNumber,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        orderStatus: order.orderStatus,
        customer: order.customerName,
        placedAt: order.createdAt,
        lastUpdated: order.updatedAt,
        scans: scans,
        courier: order.courier || 'Manual Fulfillment'
      }
    });
  } catch (err) {
    console.error('[TRACK BY ID ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
