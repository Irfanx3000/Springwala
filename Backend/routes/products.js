const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, deleteProductImage, bulkUpload, toggleProduct,
  bulkDelete, bulkUpdateStatus, getPublicProducts
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { uploadProduct, uploadBulk } = require('../middleware/upload');

router.get('/', getProducts);
router.get('/:id', getProduct);// 🌍 Public route (NO auth)

router.post('/', protect, uploadProduct.array('images', 10), createProduct);
router.post('/bulk-upload', protect, uploadBulk.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 1 }]), bulkUpload);
router.post('/bulk-delete', protect, bulkDelete);
router.patch('/bulk-status', protect, bulkUpdateStatus);
router.put('/:id', protect, uploadProduct.array('images', 10), updateProduct);
router.delete('/:id/image', protect, deleteProductImage);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/toggle', protect, toggleProduct);

module.exports = router;
