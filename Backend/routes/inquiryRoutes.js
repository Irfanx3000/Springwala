const express = require('express');
const router = express.Router();
const {
  submitInquiry,
  subscribeNewsletter,
  submitComingSoonNotification,
  getInquiries,
  getInquiry,
  markInquiryRead,
  updateInquiryStatus,
  getInquiryStats,
  getNewsletterSubs,
  deleteNewsletterSub,
  getComingSoonNotifications,
  markComingSoonNotificationViewed
} = require('../controllers/inquiryController');
const { protect } = require('../middleware/auth');
const {
  inquiryLimiter,
  newsletterLimiter,
  comingSoonLimiter
} = require('../middleware/rateLimiter');

// ── Public User-Facing Routes ────────────────────────────────────────────────
router.post('/', inquiryLimiter, submitInquiry);
router.post('/newsletter', newsletterLimiter, subscribeNewsletter);
router.post('/coming-soon', comingSoonLimiter, submitComingSoonNotification);

// ── Protected Admin Routes ────────────────────────────────────────────────────
router.get('/stats', protect, getInquiryStats);
router.get('/newsletter', protect, getNewsletterSubs);
router.delete('/newsletter/:id', protect, deleteNewsletterSub);
router.get('/coming-soon', protect, getComingSoonNotifications);
router.patch('/coming-soon/:id/viewed', protect, markComingSoonNotificationViewed);

router.get('/', protect, getInquiries);
router.get('/:id', protect, getInquiry);
router.patch('/:id/read', protect, markInquiryRead);
router.patch('/:id/status', protect, updateInquiryStatus);

module.exports = router;
