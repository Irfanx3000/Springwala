/**
 * routes/inventory.js
 * IMPORTANT: specific routes (stats, logs, bulk-update) MUST come
 * before parameterized routes (/:productId) to avoid Express mismatching.
 */
const express = require('express');
const router  = express.Router();
const {
  getInventory, getInventoryStats, updateStock,
  bulkUpdateStock, getInventoryLogs, getAllLogs,
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

// ── Specific routes first ─────────────────────────────────────────────────────
router.get('/stats',       protect, getInventoryStats);
router.get('/logs',        protect, getAllLogs);
router.put('/bulk-update', protect, bulkUpdateStock);

// ── Parameterized routes after ────────────────────────────────────────────────
router.get('/',                       protect, getInventory);
router.put('/:productId/stock',       protect, updateStock);
router.get('/:productId/logs',        protect, getInventoryLogs);

module.exports = router;
