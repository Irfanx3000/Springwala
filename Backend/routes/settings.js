const express = require('express');
const router = express.Router();
const { getAdmins, updateProfile, toggleAdmin, deleteAdmin } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/admins', protect, authorize('superadmin'), getAdmins);
router.put('/profile', protect, updateProfile);
router.patch('/admins/:id/toggle', protect, authorize('superadmin'), toggleAdmin);
router.delete('/admins/:id', protect, authorize('superadmin'), deleteAdmin);

module.exports = router;
