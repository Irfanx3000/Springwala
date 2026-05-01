const express = require('express');
const router = express.Router();
const {
  getOrders, getOrder, updateOrderStatus,
  exportOrdersCSV, exportOrdersXLSX, getOrderStats,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.get('/stats', protect, getOrderStats);
router.get('/export/csv', protect, exportOrdersCSV);
router.get('/export/xlsx', protect, exportOrdersXLSX);
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router;
