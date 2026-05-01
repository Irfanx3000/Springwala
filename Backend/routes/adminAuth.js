/**
 * routes/adminAuth.js  —  mounted at /api/auth
 *
 * Admin auth routes sit under /api/auth/admin/* to prevent collision
 * with user auth routes also mounted at /api/auth/*.
 *
 * Admin login  → POST /api/auth/admin/login
 * User  login  → POST /api/auth/login         (routes/authRoutes.js)
 */
const express = require('express');
const router  = express.Router();
const { login, getMe, register, changePassword } = require('../controllers/adminAuthController');
const { protect, authorize } = require('../middleware/auth');

router.post('/admin/login',            login);
router.get('/admin/me',                protect, getMe);
router.post('/admin/register',         protect, authorize('superadmin'), register);
router.put('/admin/change-password',   protect, changePassword);

module.exports = router;
