const express = require('express');
const router = express.Router();
const {
  submitInquiry,
  subscribeNewsletter,
  getInquiries,
  getInquiry,
  markInquiryRead,
  updateInquiryStatus,
  getInquiryStats,
  getNewsletterSubs,
  deleteNewsletterSub
} = require('../controllers/inquiryController');
const { protect } = require('../middleware/auth');

// ── Public User-Facing Routes ────────────────────────────────────────────────
router.post('/', submitInquiry);
router.post('/newsletter', subscribeNewsletter);

// ── Protected Admin Routes ────────────────────────────────────────────────────
router.get('/stats', protect, getInquiryStats);
router.get('/newsletter', protect, getNewsletterSubs);
router.delete('/newsletter/:id', protect, deleteNewsletterSub);

router.get('/', protect, getInquiries);
router.get('/:id', protect, getInquiry);
router.patch('/:id/read', protect, markInquiryRead);
router.patch('/:id/status', protect, updateInquiryStatus);

module.exports = router;
