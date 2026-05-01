const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getRevenueChart, getOrdersByStatus,
  getTopProducts, getSalesByCategory, getUserGrowth,
  getTopCustomers, getPaymentMethods, getMonthlyRevenue,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.get('/dashboard', protect, getDashboardStats);
router.get('/revenue', protect, getRevenueChart);
router.get('/orders-by-status', protect, getOrdersByStatus);
router.get('/top-products', protect, getTopProducts);
router.get('/sales-by-category', protect, getSalesByCategory);
router.get('/user-growth', protect, getUserGrowth);
router.get('/top-customers', protect, getTopCustomers);
router.get('/payment-methods', protect, getPaymentMethods);
router.get('/monthly-revenue', protect, getMonthlyRevenue);

module.exports = router;
