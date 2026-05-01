/**
 * controllers/adminAuthController.js
 * Admin authentication — login, getMe, register (superadmin), change-password.
 * All operations are against the Admin model, never the User model.
 * Tokens generated here do NOT include a role claim, so they are
 * automatically rejected by userAuth middleware on user routes.
 */
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

const generateAdminToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/admin/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!admin.isActive)
      return res.status(401).json({ success: false, message: 'Account is deactivated' });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = generateAdminToken(admin._id);
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, avatar: admin.avatar },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/admin/me
exports.getMe = async (req, res) => {
  res.json({ success: true, admin: req.admin });
};

// POST /api/auth/admin/register  (superadmin only)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await Admin.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: 'Admin already exists with this email' });

    const admin = await Admin.create({ name, email, password, role });
    const token = generateAdminToken(admin._id);
    res.status(201).json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/admin/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+password');
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
