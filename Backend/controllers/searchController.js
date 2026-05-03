const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc  Global search across products, orders, customers
// @route GET /api/search
exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, results: { products: [], orders: [], customers: [] } });

    const searchRegex = { $regex: q, $options: 'i' };

    const [products, orders, customers] = await Promise.all([
      // Search Products: name, sku, brand
      Product.find({
        $or: [
          { name: searchRegex },
          { sku:  searchRegex },
          { brand: searchRegex }
        ]
      }).limit(5).select('name images sku price finalPrice'),

      // Search Orders: orderID (if stored as string), shipping address name
      Order.find({
        $or: [
          { orderID: searchRegex },
          { 'shippingAddress.name': searchRegex }
        ]
      }).limit(5).select('orderID totalPrice status createdAt'),

      // Search Customers: name, email, phone
      User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).limit(5).select('name email phone avatar')
    ]);

    res.json({
      success: true,
      results: {
        products,
        orders,
        customers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
