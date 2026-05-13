const express = require('express');
const router  = express.Router();
const {
  getAdmins, updateProfile, toggleAdmin, deleteAdmin,
  getSiteSettings, updateSiteSettings
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { uploadBranding } = require('../middleware/upload');

// ── Site Settings ─────────────────────────────────────────────────────────────
// PUBLIC: user-facing pages fetch settings for footer/branding (no auth needed)
router.get('/site', getSiteSettings);

// PROTECTED: only superadmins can update
router.put(
  '/site',
  protect,
  authorize('superadmin'),
  uploadBranding.fields([
    { name: 'logo',    maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
  ]),
  updateSiteSettings
);

// ── Admin Management ──────────────────────────────────────────────────────────
router.get('/admins',            protect, authorize('superadmin'), getAdmins);
router.put('/profile',           protect, updateProfile);
router.patch('/admins/:id/toggle', protect, authorize('superadmin'), toggleAdmin);
router.delete('/admins/:id',     protect, authorize('superadmin'), deleteAdmin);

module.exports = router;
