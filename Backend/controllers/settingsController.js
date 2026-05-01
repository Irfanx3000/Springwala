const Admin = require('../models/Admin');

// @desc    Get all admins
// @route   GET /api/settings/admins
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update admin profile
// @route   PUT /api/settings/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    if (name) admin.name = name;
    if (email) {
      const emailExists = await Admin.findOne({ email, _id: { $ne: req.admin._id } });
      if (emailExists) return res.status(400).json({ success: false, message: 'Email already in use' });
      admin.email = email;
    }
    if (req.file) admin.avatar = `/uploads/avatars/${req.file.filename}`;

    await admin.save();
    res.json({ success: true, message: 'Profile updated successfully', admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle admin active status (superadmin only)
// @route   PATCH /api/settings/admins/:id/toggle
exports.toggleAdmin = async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    admin.isActive = !admin.isActive;
    await admin.save();
    res.json({ success: true, message: `Admin ${admin.isActive ? 'activated' : 'deactivated'}`, isActive: admin.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete admin (superadmin only)
// @route   DELETE /api/settings/admins/:id
exports.deleteAdmin = async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    await admin.deleteOne();
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
