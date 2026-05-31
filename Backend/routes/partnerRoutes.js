const express = require('express');
const router = express.Router();
const { submitPartnerApplication } = require('../controllers/partnerController');

// Public route for onboarding registration
router.post('/', submitPartnerApplication);

module.exports = router;
