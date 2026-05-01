/**
 * controllers/userController.js
 * User profile routes — protected by protectUser middleware (user JWT).
 * req.user is set by userAuth.js and is already filtered for isActive.
 */
const User     = require('../models/User');
const { AppError } = require('../middleware/errorMiddleware');

// GET /api/user/profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return next(new AppError('User not found', 404));

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/profile
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404));

    // Update root level fields
    const rootFields = ['firstName', 'lastName', 'phoneNumber', 'alternatePhone', 'profileImage', 'country', 'state'];
    rootFields.forEach(field => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });

    // Update nested objects (merging instead of overwriting)
    const nestedFields = ['companyProfile', 'gstin', 'billingAddress', 'shippingAddress'];
    nestedFields.forEach(section => {
      if (req.body[section] && typeof req.body[section] === 'object') {
        if (!user[section]) user[section] = {};
        // Merge existing data with new data
        Object.assign(user[section], req.body[section]);
        // Tell Mongoose that the nested object has changed
        user.markModified(section);
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: await User.findById(user._id).select('-password')
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404));

    if (!user.password)
      return next(new AppError('Google OAuth users cannot change password here. Use Google login.', 400));

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return next(new AppError('Current password is incorrect', 401));

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/user/upload-image
const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded', 400));

    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404));

    // Save relative path: /uploads/users/profileImage-12345.jpg
    const relativePath = `/uploads/users/${req.file.filename}`;
    user.profileImage = relativePath;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      profileImage: relativePath,
      user: await User.findById(user._id).select('-password')
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, changePassword, uploadProfileImage };
