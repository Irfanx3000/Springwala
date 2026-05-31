const express = require('express');
const router = express.Router();
const { submitPartnerApplication } = require('../controllers/partnerController');
const { partnerLimiter } = require('../middleware/rateLimiter');

// Public route for onboarding registration
router.post('/', partnerLimiter, submitPartnerApplication);

module.exports = router;
