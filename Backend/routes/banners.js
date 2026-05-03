const express = require('express');
const router = express.Router();
const {
  getBanners, getBanner, createBanner, updateBanner,
  deleteBanner, toggleBanner, reorderBanners, getPublicBanners,
} = require('../controllers/bannerController');
const { protect } = require('../middleware/auth');
const { uploadBanner } = require('../middleware/upload');

router.get('/', getPublicBanners);
router.get('/admin', protect, getBanners); // Admin view
router.get('/:id', getBanner);
router.post('/', protect, uploadBanner.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), createBanner);
router.put('/reorder', protect, reorderBanners);
router.put('/:id', protect, uploadBanner.fields([{ name: 'image', maxCount: 1 }, { name: 'mobileImage', maxCount: 1 }]), updateBanner);
router.delete('/:id', protect, deleteBanner);
router.patch('/:id/toggle', protect, toggleBanner);

module.exports = router;
