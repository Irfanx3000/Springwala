const User = require('../models/User');
const Product = require('../models/Product');

/**
 * GET /api/user/wishlist
 * Returns the logged-in user's wishlist with populated product details.
 */
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      wishlist: user.wishlist || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/user/wishlist/toggle
 * Adds/Removes a product from the wishlist.
 */
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const index = user.wishlist.indexOf(productId);
    let action = 'added';

    if (index > -1) {
      // Remove
      user.wishlist.splice(index, 1);
      action = 'removed';
    } else {
      // Add
      user.wishlist.push(productId);
      action = 'added';
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Product ${action} to wishlist`,
      action,
      wishlistCount: user.wishlist.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
