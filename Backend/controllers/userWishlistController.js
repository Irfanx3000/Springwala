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
      products: user.wishlist || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Use string comparison for safety with ObjectIds
    const index = user.wishlist.findIndex(id => id.toString() === productId.toString());
    let action = 'added';

    if (index > -1) {
      user.wishlist.splice(index, 1);
      action = 'removed';
    } else {
      user.wishlist.push(productId);
      action = 'added';
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Product ${action} to wishlist`,
      action,
      wishlist: user.wishlist
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
