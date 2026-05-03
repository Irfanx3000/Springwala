const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protectUser — verifies JWT and attaches req.user
 * Completely separate from the existing admin 'protect' middleware.
 */
const protectUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log(`[AUTH-TRACE] Token extracted for path: ${req.path}`);
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token must have role: 'user' to prevent admin tokens from accessing user routes
    if (decoded.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Access denied. Not a user token.' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = { protectUser };
