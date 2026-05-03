const express = require('express');
const router = express.Router();
const {
  getCategories, getCategory, createCategory, updateCategory,
  deleteCategory, toggleCategory, getCategoriesDropdown,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { uploadCategory } = require('../middleware/upload');

router.get('/dropdown', getCategoriesDropdown);
router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', protect, uploadCategory.single('banner'), createCategory);
router.put('/:id', protect, uploadCategory.single('banner'), updateCategory);
router.delete('/:id', protect, deleteCategory);
router.patch('/:id/toggle', protect, toggleCategory);

module.exports = router;
