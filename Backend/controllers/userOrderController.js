const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');

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
  const rate = await getShippingRate({ pincode, weight });
  console.log("[SHIPPING RATE]", rate);

  if (rate && rate > 0) {
    return rate;
  }

  // Fallback Rule: ₹120 for orders < 1000, else FREE
  return totalAmount >= 1000 ? 0 : 120;
};

// --- Mock Shipment System ---
const generateMockAWB = () => "SWP" + Date.now() + Math.floor(Math.random() * 1000);

async function createShipment(order) {
  // TODO: Replace with real Delhivery / Courier API call later
  const awb = generateMockAWB();
  const trackingUrl = `https://springwala.com/track/${awb}`; // Placeholder URL

  return {
    awb,
    trackingUrl,
    status: "Ready to Ship"
  };
}

// --- Pricing Single Source of Truth (SSOT) ---
const calculatePricing = async (bodyItems, pincode) => {
  let totalAmount = 0;
  let totalWeight = 0;
  const validatedItems = [];

  for (const item of bodyItems) {
    const product = await Product.findById(item.product).select('name finalPrice price basePrice discountedPrice weight');
    if (product) {
      const price = Number(product.finalPrice || product.discountedPrice || product.basePrice || product.price || 0);
      const quantity = Number(item.quantity || 1);
      const weight = Number(product.weight || 1); // Default 1kg if not set
      const subtotal = price * quantity;

      totalAmount += subtotal;
      totalWeight += weight * quantity;

      validatedItems.push({
        product: product._id,
        name: product.name,
        quantity,
        price,
        subtotal,
        finalPrice: price,
        total: subtotal,
        weight: weight,
        image: item.image || ''
      });
    }
  }

  let deliveryCharges = await getDeliveryCharges({
    totalAmount,
    pincode,
    weight: totalWeight
  });

  if (!deliveryCharges || isNaN(deliveryCharges)) deliveryCharges = 0;

  const finalAmount = totalAmount + deliveryCharges;

  return {
    items: validatedItems,
    totalAmount,
    deliveryCharges,
    finalAmount,
    totalWeight
  };
};

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

    const { totalAmount, deliveryCharges, finalAmount, items: validatedItems } = pricing;
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
      subtotal: totalAmount, // For legacy/schema requirement
      gstAmount: 0,
      shippingCharge: deliveryCharges,
      deliveryCharges: deliveryCharges,
      totalAmount: totalAmount, // Items Total
      finalAmount: finalAmount, // Grand Total
      paymentMethod,
      paymentStatus: req.body.paymentStatus || 'Pending',
      paymentDetails: req.body.paymentDetails || {},
      orderStatus: 'Ordered',
      notes: notes || '',
      statusHistory: [{ status: 'Ordered', updatedBy: 'User', note: req.body.paymentStatus === 'Completed' ? 'Order placed & Paid online' : 'Order placed' }]
    });

    // ─── AUTO-GENERATE SHIPMENT (Mock) ───
    const shipment = await createShipment(order);
    order.awb = shipment.awb;
    order.trackingUrl = shipment.trackingUrl;
    order.shipmentStatus = shipment.status;
    order.trackingNumber = shipment.awb; // Sync for consistency
    await order.save();

    console.log("[SHIPMENT CREATED]", { awb: order.awb, status: order.shipmentStatus });

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
    if (!bodyItems || !bodyItems.length) {
      return res.json({ success: true, totalAmount: 0, deliveryCharges: 0, finalAmount: 0 });
    }

    const pricing = await calculatePricing(bodyItems, pincode);

    res.json({
      success: true,
      totalAmount: pricing.totalAmount,
      deliveryCharges: pricing.deliveryCharges,
      finalAmount: pricing.finalAmount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/user/orders/track/:awb ─────────────────────────────────────────
exports.trackOrder = async (req, res) => {
  try {
    const { awb } = req.params;
    const order = await Order.findOne({ awb }).select('awb shipmentStatus orderStatus customerName createdAt updatedAt');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Tracking information not found for this ID.' });
    }

    res.json({
      success: true,
      tracking: {
        awb: order.awb,
        status: order.shipmentStatus,
        orderStatus: order.orderStatus,
        customer: order.customerName,
        placedAt: order.createdAt,
        lastUpdated: order.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
