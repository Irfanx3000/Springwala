const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');

// Helper: get date range
const getDateRange = (range) => {
  const now = new Date();
  let start;
  if (range === '7d') start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  else if (range === '30d') start = new Date(now - 30 * 24 * 60 * 60 * 1000);
  else if (range === '90d') start = new Date(now - 90 * 24 * 60 * 60 * 1000);
  else if (range === '1y') start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now - 30 * 24 * 60 * 60 * 1000);
  return { start, end: now };
};

// @desc    Dashboard summary stats
// @route   GET /api/analytics/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalOrders, ordersThisMonth, ordersLastMonth,
      totalUsers, usersThisMonth,
      revenueThisMonth, revenueLastMonth,
      totalProducts, outOfStock,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.aggregate([{ $match: { paymentStatus: 'Completed', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { paymentStatus: 'Completed', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: 0 }),
      Order.find().populate('user', 'name').sort({ createdAt: -1 }).limit(5).select('orderId user orderStatus totalAmount createdAt'),
    ]);

    const revThis = revenueThisMonth[0]?.total || 0;
    const revLast = revenueLastMonth[0]?.total || 0;
    const orderGrowth = ordersLastMonth ? (((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100).toFixed(1) : 0;
    const revenueGrowth = revLast ? (((revThis - revLast) / revLast) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      stats: {
        totalOrders, ordersThisMonth, orderGrowth: `${orderGrowth}%`,
        totalUsers, usersThisMonth,
        revenueThisMonth: revThis, revenueGrowth: `${revenueGrowth}%`,
        totalProducts, outOfStock,
      },
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Revenue over time (chart data)
// @route   GET /api/analytics/revenue?range=30d
exports.getRevenueChart = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start } = getDateRange(range);

    const data = await Order.aggregate([
      { $match: { paymentStatus: 'Completed', createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Orders by status
// @route   GET /api/analytics/orders-by-status
exports.getOrdersByStatus = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Top selling products
// @route   GET /api/analytics/top-products?limit=10
exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10, range = '30d' } = req.query;
    const { start } = getDateRange(range);

    const data = await Order.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: Number(limit) },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Sales by category
// @route   GET /api/analytics/sales-by-category
exports.getSalesByCategory = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start } = getDateRange(range);

    const data = await Order.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.name' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    New users over time
// @route   GET /api/analytics/user-growth?range=30d
exports.getUserGrowth = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start } = getDateRange(range);

    const data = await User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Top customers by spend
// @route   GET /api/analytics/top-customers?limit=10
exports.getTopCustomers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const data = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalSpent: 1,
          totalOrders: 1,
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Payment method breakdown
// @route   GET /api/analytics/payment-methods
exports.getPaymentMethods = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Monthly revenue summary (current year)
// @route   GET /api/analytics/monthly-revenue
exports.getMonthlyRevenue = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const data = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'Completed',
          createdAt: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = months.map((month, i) => {
      const found = data.find(d => d._id === i + 1);
      return { month, revenue: found?.revenue || 0, orders: found?.orders || 0 };
    });

    res.json({ success: true, year, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
