const express = require('express');
const router = express.Router();
const {
  getPartnerApplications,
  getPartnerApplication,
  updatePartnerStatus
} = require('../controllers/partnerController');
const { protect } = require('../middleware/auth');

// Protected admin endpoints for managing waitlist applications
router.get('/', protect, getPartnerApplications);
router.get('/:id', protect, getPartnerApplication);
router.patch('/:id/status', protect, updatePartnerStatus);

module.exports = router;
