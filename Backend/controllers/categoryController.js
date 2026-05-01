const Category = require('../models/Category');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

// @desc    Get all categories (with subcategories)
// @route   GET /api/categories
exports.getCategories = async (req, res) => {
  try {
    const { search, isActive, sort, page = 1, limit = 50 } = req.query;
    const query = { parentCategory: null };

    if (search) query.name = { $regex: search, $options: 'i' };
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    let sortObj = { sortOrder: 1, createdAt: -1 };
    if (sort === 'date-desc') sortObj = { createdAt: -1 };
    else if (sort === 'name-asc') sortObj = { name: 1 };

    const skip = (page - 1) * limit;
    const categoriesDoc = await Category.find(query)
      .populate({ path: 'subcategories', options: { sort: sortObj } })
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const categories = [];
    for (const catDoc of categoriesDoc) {
       const cat = catDoc.toObject();
       cat.productCount = await Product.countDocuments({ category: cat._id });
       for (const sub of cat.subcategories) {
          sub.productCount = await Product.countDocuments({ category: sub._id });
       }
       categories.push(cat);
    }

    const total = await Category.countDocuments(query);
    const globalTotalCategories = await Category.countDocuments({ parentCategory: null });
    const totalSubCategories = await Category.countDocuments({ parentCategory: { $ne: null } });
    const activeCategoriesCount = await Category.countDocuments({ parentCategory: null, isActive: true });
    const activeSubCategoriesCount = await Category.countDocuments({ parentCategory: { $ne: null }, isActive: true });
    const totalProducts = await Product.countDocuments();

    res.json({ 
      success: true, 
      total, 
      globalTotalCategories,
      totalSubCategories, 
      activeCategoriesCount, 
      activeSubCategoriesCount,
      totalProducts, 
      page: Number(page), 

      categories 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate('subcategories');
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create category or subcategory
// @route   POST /api/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentCategory, sortOrder } = req.body;
    const banner = req.file ? `/uploads/categories/${req.file.filename}` : '';

    // Check duplicate slug
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Category.findOne({ slug });
    if (existing) slug = slug + '-' + Date.now();

    const category = await Category.create({
      name, slug, description, banner,
      parentCategory: parentCategory || null,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({ success: true, message: 'Category created successfully', category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const { name, description, isActive, sortOrder } = req.body;
    if (name) { category.name = name; }
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive === 'true' || isActive === true;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;

    if (req.file) {
      // Delete old banner
      if (category.banner) {
        const oldPath = path.join(__dirname, '..', category.banner);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      category.banner = `/uploads/categories/${req.file.filename}`;
    }

    await category.save();
    res.json({ success: true, message: 'Category updated successfully', category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    // Check if products are linked
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) return res.status(400).json({ success: false, message: `Cannot delete: ${productCount} products are linked to this category` });

    // Check if has subcategories
    const subCount = await Category.countDocuments({ parentCategory: req.params.id });
    if (subCount > 0) return res.status(400).json({ success: false, message: `Cannot delete: ${subCount} subcategories exist` });

    // Delete banner image
    if (category.banner) {
      const filePath = path.join(__dirname, '..', category.banner);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle category visibility
// @route   PATCH /api/categories/:id/toggle
exports.toggleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    category.isActive = !category.isActive;
    await category.save();
    res.json({ success: true, message: `Category ${category.isActive ? 'activated' : 'deactivated'}`, isActive: category.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all categories flat (for dropdowns)
// @route   GET /api/categories/dropdown
exports.getCategoriesDropdown = async (req, res) => {
  try {
    const categories = await Category.find().select('name slug parentCategory').sort('name');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
