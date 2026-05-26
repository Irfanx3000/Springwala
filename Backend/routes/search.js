const express = require('express');
const router = express.Router();
const { globalSearch, storefrontSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/auth');

router.get('/', storefrontSearch);
router.get('/admin', protect, globalSearch);

module.exports = router;
