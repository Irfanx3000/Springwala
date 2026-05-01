const Order   = require('../models/Order');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');
const User    = require('../models/User');

const generateOrderNumber = async () => {
  const count = await Order.countDocuments();
  return `SW${String(count + 1).padStart(6, "0")}`;
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

    // 2. Server-side calculation & Stock check
    let subtotal = 0;
    let totalGST = 0;
    const validatedItems = [];

    for (const item of bodyItems) {
      const product = await Product.findById(item.product).select('name price discountedPrice gstPercent stock isActive');
      
      if (!product || !product.isActive) {
        return res.status(400).json({ success: false, message: `Product "${item.name}" is no longer available.` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.name}".` });
      }

      const price = product.price;
      const discountedPrice = product.discountedPrice || price;
      const gstPercent = product.gstPercent || 0;
      const qty = item.quantity;

      const itemTotal = discountedPrice * qty;
      const itemGST = (itemTotal * gstPercent) / 100;

      subtotal += itemTotal;
      totalGST += itemGST;

      validatedItems.push({
        product: product._id,
        name: product.name,
        quantity: qty,
        price: price,
        discountedPrice: discountedPrice,
        image: item.image || ''
      });
    }

    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const totalAmount = subtotal + totalGST + shippingCharge;

    // 3. Generate Unique Order Number
    const orderNumber = await generateOrderNumber();

    // 4. Create Order
    const user = await User.findById(req.user._id);
    const order = await Order.create({
      orderNumber,
      user: req.user._id,
      customerName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown Customer',
      items: validatedItems,
      shippingAddress,
      subtotal,
      gstAmount: totalGST,
      shippingCharge,
      totalAmount,
      paymentMethod,
      paymentStatus: req.body.paymentStatus || 'Pending',
      paymentDetails: req.body.paymentDetails || {},
      orderStatus: 'Ordered',
      notes: notes || '',
      statusHistory: [{ status: 'Ordered', updatedBy: 'User', note: req.body.paymentStatus === 'Completed' ? 'Order placed & Paid online' : 'Order placed' }]
    });

    // --- Generate Invoice & Send Email (Non-blocking) ---
    const generateInvoice = require('../utils/generateInvoice');
    const { sendOrderConfirmationEmail } = require('../services/emailService');

    const invoicePath = await generateInvoice(order);
    order.invoiceUrl = invoicePath;
    await order.save();

    // Send email asynchronously
    sendOrderConfirmationEmail({
      email: user.email,
      name: user.firstName,
      order: order,
      invoicePath: invoicePath
    }).catch(err => console.error('Email confirmation error:', err));

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
      message: 'Order placed successfully!',
      orderId: order._id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount
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
      .populate('items.product', 'name images price slug');

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

    order.orderStatus  = 'Cancelled';
    order.cancelReason = cancelReason || 'Cancelled by user';
    order.statusHistory.push({
      status:    'Cancelled',
      updatedBy: 'User',
      note:      cancelReason || 'Cancelled by user',
    });
    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully.', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
