const express = require('express');
const router = express.Router();
const { createOrderShipment, trackAndSyncShipment, syncAllActiveShipments } = require('../controllers/shippingController');
const { protect } = require('../middleware/auth');

// Admin only routes
router.post('/create/:orderId', protect, createOrderShipment);
router.get('/track/:waybill', protect, trackAndSyncShipment);
router.post('/sync-all', protect, syncAllActiveShipments);

module.exports = router;
