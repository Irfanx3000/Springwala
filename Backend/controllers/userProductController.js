const Product = require('../models/Product');
const Category = require('../models/Category');


// ─────────────────────────────────────────────
// GET ALL PRODUCTS
// ─────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const {
      search, category, isFeatured, tags,
      page = 1, limit = 20,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) query.category = category;
    if (req.query.subcategory) query.subcategory = req.query.subcategory;
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

    const skip = (Number(page) - 1) * Number(limit);
    const sortOpt = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .select('-__v')
        .sort(sortOpt)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// FEATURED PRODUCTS
// ─────────────────────────────────────────────
exports.getFeaturedProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;

    const products = await Product.find({
      isActive: true,
      isFeatured: true
    })
      .populate('category', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// TOP SOLD PRODUCTS
// ─────────────────────────────────────────────
exports.getTopSoldProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;

    const products = await Product.find({
      isActive: true,
      totalSold: { $gt: 0 }
    })
      .populate('category', 'name slug')
      .select('-__v')
      .sort({ totalSold: -1 })
      .limit(limit);

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// LATEST PRODUCTS
// ─────────────────────────────────────────────
exports.getLatestProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;

    const products = await Product.find({ isActive: true })
      .populate('category', 'name slug')
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// SINGLE PRODUCT
// ─────────────────────────────────────────────
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true
    })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .select('-__v');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// RELATED PRODUCTS
// ─────────────────────────────────────────────
exports.getRelatedProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('category');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const limit = Number(req.query.limit) || 8;

    const related = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true
    })
      .populate('category', 'name slug')
      .select('-__v')
      .limit(limit);

    res.json({ success: true, products: related });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isActive: true,
      parentCategory: null
    })
      .populate({ path: 'subcategories', match: { isActive: true } })
      .select('name slug banner subcategories')
      .sort({ sortOrder: 1, name: 1 });

    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// SEARCH PRODUCTS
// ─────────────────────────────────────────────
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, products: [] });
    }

    const regex = { $regex: q.trim(), $options: 'i' };

    const products = await Product.find({
      isActive: true,
      $or: [
        { name: regex },
        { brand: regex },
        { tags: regex }
      ]
    })
      .select('name images price discountedPrice finalPrice discountPercent slug')
      .limit(10);

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
