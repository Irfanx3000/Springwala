const mongoose = require('mongoose');
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
      priceMin, priceMax, inStockOnly
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

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category, isActive: true });
        if (catDoc) {
          query.category = catDoc._id;
        } else {
          query.category = new mongoose.Types.ObjectId();
        }
      }
    }

    if (req.query.subcategory) {
      const subcat = req.query.subcategory;
      if (mongoose.Types.ObjectId.isValid(subcat)) {
        query.subcategory = subcat;
      } else {
        const subcatDoc = await Category.findOne({ slug: subcat, isActive: true });
        if (subcatDoc) {
          query.subcategory = subcatDoc._id;
        } else {
          query.subcategory = new mongoose.Types.ObjectId();
        }
      }
    }
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };

    // Server-side price filtering (finalPrice)
    if (priceMin !== undefined || priceMax !== undefined) {
      query.finalPrice = {};
      if (priceMin !== undefined && priceMin !== '') {
        query.finalPrice.$gte = Number(priceMin);
      }
      if (priceMax !== undefined && priceMax !== '') {
        query.finalPrice.$lte = Number(priceMax);
      }
    }

    // Server-side stock filtering
    if (inStockOnly === 'true') {
      query.stock = { $gt: 0 };
    }

    // 13 Sort Strategies Mapping
    let sortOpt = {};
    switch (sortBy) {
      case 'featured':
        sortOpt = { isFeatured: -1, createdAt: -1 };
        break;
      case 'best_sellers':
        sortOpt = { totalSold: -1, createdAt: -1 };
        break;
      case 'newly_added':
      case 'newest':
        sortOpt = { createdAt: -1 };
        break;
      case 'price_asc':
        sortOpt = { finalPrice: 1, createdAt: -1 };
        break;
      case 'price_desc':
        sortOpt = { finalPrice: -1, createdAt: -1 };
        break;
      case 'popular':
        sortOpt = { viewCount: -1, createdAt: -1 };
        break;
      case 'top_rated':
        sortOpt = { rating: -1, totalReviews: -1, createdAt: -1 };
        break;
      case 'limited_stock':
        sortOpt = { stock: 1, createdAt: -1 };
        break;
      case 'discounted':
        sortOpt = { discountPercent: -1, createdAt: -1 };
        break;
      case 'trending':
        sortOpt = { viewCount: -1, totalSold: -1, createdAt: -1 };
        break;
      case 'recommended':
        sortOpt = { rating: -1, isFeatured: -1, createdAt: -1 };
        break;
      case 'alphabetical_asc':
      case 'name_asc':
        sortOpt = { name: 1 };
        break;
      case 'alphabetical_desc':
      case 'name_desc':
        sortOpt = { name: -1 };
        break;
      default:
        sortOpt = { [sortBy]: order === 'asc' ? 1 : -1 };
        break;
    }

    const skip = (Number(page) - 1) * Number(limit);

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
    const isId = mongoose.Types.ObjectId.isValid(req.params.id);
    const query = isId
      ? { _id: req.params.id, isActive: true }
      : { slug: req.params.id, isActive: true };

    const product = await Product.findOne(query)
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
    const isId = mongoose.Types.ObjectId.isValid(req.params.id);
    const query = isId ? { _id: req.params.id } : { slug: req.params.id };
    const product = await Product.findOne(query).select('category');

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
    const includeEmpty = req.query.includeEmpty === 'true';

    // Get unique category and subcategory IDs from active products
    const [activeCategoryIds, activeSubcategoryIds] = await Promise.all([
      Product.distinct('category', { isActive: true }),
      Product.distinct('subcategory', { isActive: true })
    ]);

    const activeCatSet = new Set(activeCategoryIds.map(id => id.toString()));
    const activeSubcatSet = new Set(activeSubcategoryIds.filter(id => id).map(id => id.toString()));

    const categories = await Category.find({
      isActive: true,
      parentCategory: null
    })
      .populate({ path: 'subcategories', match: { isActive: true } })
      .select('name slug banner subcategories')
      .sort({ sortOrder: 1, name: 1 });

    const filteredCategories = categories.map(cat => {
      const plainCat = cat.toObject ? cat.toObject({ virtuals: true }) : cat;
      
      if (plainCat.subcategories && Array.isArray(plainCat.subcategories)) {
        plainCat.subcategories = includeEmpty
          ? plainCat.subcategories
          : plainCat.subcategories.filter(sub => activeSubcatSet.has(sub._id.toString()));
      } else {
        plainCat.subcategories = [];
      }

      return plainCat;
    }).filter(cat => {
      if (includeEmpty) return true;
      const hasDirectProducts = activeCatSet.has(cat._id.toString());
      const hasActiveSubcategories = cat.subcategories && cat.subcategories.length > 0;
      return hasDirectProducts || hasActiveSubcategories;
    });

    res.json({ success: true, categories: filteredCategories });
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
