const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');

// @desc    Get all orders
// @route   GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const { search, orderStatus, paymentStatus, paymentMethod, startDate, endDate, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    const query = {};

    if (search) query.$or = [{ orderNumber: { $regex: search, $options: 'i' } }, { customerName: { $regex: search, $options: 'i' } }, { 'shippingAddress.fullName': { $regex: search, $options: 'i' } }];
    if (orderStatus) query.orderStatus = orderStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const skip = (page - 1) * limit;
    const sortOption = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [orders, total] = await Promise.all([
      Order.find(query).populate('user', 'firstName lastName email phoneNumber').populate('items.product', 'name images').sort(sortOption).skip(skip).limit(Number(limit)),
      Order.countDocuments(query),
    ]);

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email phoneNumber').populate('items.product', 'name images price');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, trackingNumber, courier, note, cancelReason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (orderStatus) {
      order.statusHistory.push({ status: orderStatus, updatedBy: req.admin.name, note: note || '' });
      order.orderStatus = orderStatus;

      // Restore stock if cancelled
      if (orderStatus === 'Cancelled') {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
        if (cancelReason) order.cancelReason = cancelReason;
      }
    }

    if (paymentStatus) order.paymentStatus = paymentStatus;
    // ─── MANUAL TRACKING SSOT ───
if (trackingNumber && trackingNumber.trim()) {
  order.trackingNumber = trackingNumber.trim();
}

// Auto-generate if missing
if (!order.trackingNumber) {
  order.trackingNumber = `SW-TRK-${String(order.orderNumber || order._id).replace('SW', '')}`;
}
    order.courier = 'Manual Fulfillment';

    await order.save();
    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Export orders as CSV
// @route   GET /api/orders/export/csv
exports.exportOrdersCSV = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'firstName lastName email').lean();
    const data = orders.map(o => ({
      OrderID: o.orderNumber || o._id,
      Customer: o.customerName || (o.user ? `${o.user.firstName} ${o.user.lastName || ''}`.trim() : 'N/A'),
      Email: o.user?.email || '',
      Status: o.orderStatus,
      PaymentStatus: o.paymentStatus,
      PaymentMethod: o.paymentMethod,
      Total: o.totalAmount,
      Date: new Date(o.createdAt).toLocaleDateString('en-IN'),
    }));

    const parser = new Parser();
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('orders.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Export orders as XLSX
// @route   GET /api/orders/export/xlsx
exports.exportOrdersXLSX = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'firstName lastName email').lean();
    const data = orders.map(o => ({
      'Order ID': o.orderNumber || o._id,
      Customer: o.customerName || (o.user ? `${o.user.firstName} ${o.user.lastName || ''}`.trim() : 'N/A'),
      Email: o.user?.email || '',
      Status: o.orderStatus,
      'Payment Status': o.paymentStatus,
      'Payment Method': o.paymentMethod,
      'Total (₹)': o.totalAmount,
      Date: new Date(o.createdAt).toLocaleDateString('en-IN'),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('orders.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get order stats summary
// @route   GET /api/orders/stats
exports.getOrderStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalOrders, pendingOrders, completedOrders, ordersThisMonth, totalCustomers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'Pending' }),
      Order.countDocuments({ orderStatus: 'Delivered' }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({})
    ]);

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({
      success: true,
      totalRevenue,
      totalOrders,
      totalCustomers,
      pendingOrders,
      completedOrders,
      ordersThisMonth,
      averageOrderValue
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
