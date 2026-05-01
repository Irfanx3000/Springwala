/**
 * routes/adminUsers.js  —  mounted at /api/users
 * Admin user management. Uses admin JWT (middleware/auth.js → checks Admin model).
 */
const express = require('express');
const router  = express.Router();
const {
  getUsers, getUser, updateUser, toggleUser, deleteUser, getUserStats,
} = require('../controllers/adminUserController');
const { protect, authorize } = require('../middleware/auth');

router.get('/stats',        protect, getUserStats);
router.get('/',             protect, getUsers);
router.get('/:id',          protect, getUser);
router.put('/:id',          protect, updateUser);
router.patch('/:id/toggle', protect, toggleUser);
router.delete('/:id',       protect, authorize('superadmin', 'admin'), deleteUser);

module.exports = router;
