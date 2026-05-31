const express = require('express');
const router = express.Router();
const { globalSearch, storefrontSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');

router.get('/', searchLimiter, storefrontSearch);
router.get('/admin', protect, searchLimiter, globalSearch);

module.exports = router;
