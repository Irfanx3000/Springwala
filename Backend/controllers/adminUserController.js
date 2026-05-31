/**
 * controllers/adminUserController.js
 * Admin-side user management — view, update, block/unblock, delete.
 * Uses admin JWT middleware (req.admin is set). Never touches req.user.
 *
 * Field compatibility note: the User model uses firstName/lastName/phoneNumber.
 * The 'name' and 'phone' virtuals on User.js make those fields readable here.
 * Updates are handled by writing firstName/lastName/phoneNumber directly.
 */
const User  = require('../models/User');
const Order = require('../models/Order');

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const {
      search, isActive,
      page = 1, limit = 20,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const query = {};
    if (search) {
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or = [{ _id: search }];
      } else {
        query.$or = [
          { firstName:   { $regex: search, $options: 'i' } },
          { lastName:    { $regex: search, $options: 'i' } },
          { email:       { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ];
      }
    }
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip       = (Number(page) - 1) * Number(limit);
    const sortOption = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort(sortOption).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const orders = await Order.find({ user: req.params.id })
      .select('orderId orderStatus totalAmount createdAt paymentStatus')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, user, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (firstName  !== undefined) user.firstName   = firstName;
    if (lastName   !== undefined) user.lastName    = lastName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (isActive   !== undefined) user.isActive    = isActive === 'true' || isActive === true;

    await user.save();
    res.json({ success: true, message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/toggle
exports.toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();
    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'blocked'}`,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const orderCount = await Order.countDocuments({ user: req.params.id });
    if (orderCount > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot delete: user has ${orderCount} order(s). Consider blocking instead.`,
      });

    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/stats
exports.getUserStats = async (req, res) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastWeek     = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const [total, active, blocked, newThisMonth, newLastWeek] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: lastWeek } }),
    ]);

    res.json({ success: true, stats: { total, active, blocked, newThisMonth, newLastWeek } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
