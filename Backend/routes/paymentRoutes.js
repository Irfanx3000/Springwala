const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/userAuth');
const { createRazorpayOrder, verifyPayment } = require('../controllers/paymentController');

// All payment routes are protected as they involve user orders
router.post('/create-order', protectUser, createRazorpayOrder);
router.post('/verify', protectUser, verifyPayment);

module.exports = router;
