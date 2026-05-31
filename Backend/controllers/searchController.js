const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const Inquiry = require('../models/Inquiry');

// @desc  Global search across products, orders, customers (for Master Admin)
// @route GET /api/search/admin
exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, results: { products: [], orders: [], customers: [], categories: [], inquiries: [] } });

    const searchRegex = { $regex: q, $options: 'i' };

    const [products, orders, customers, categories, inquiries] = await Promise.all([
      // Search Products: name, sku, brand
      Product.find({
        $or: [
          { name: searchRegex },
          { sku:  searchRegex },
          { brand: searchRegex }
        ]
      }).limit(5).select('name images sku price finalPrice'),

      // Search Orders: orderID (if stored as string), shipping address name
      Order.find({
        $or: [
          { orderID: searchRegex },
          { 'shippingAddress.name': searchRegex }
        ]
      }).limit(5).select('orderID totalPrice status createdAt'),

      // Search Customers: name, email, phone
      User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).limit(5).select('firstName lastName email phoneNumber avatar'),

      // Search Categories: name
      Category.find({
        name: searchRegex
      }).limit(5).select('name slug banner'),

      // Search Inquiries: fullName, email, subject, message
      Inquiry.find({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { subject: searchRegex },
          { message: searchRegex }
        ]
      }).limit(5).select('fullName email subject status createdAt')
    ]);

    res.json({
      success: true,
      results: {
        products,
        orders,
        customers,
        categories,
        inquiries
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Intelligent predictive live search for storefront
// @route GET /api/search
exports.storefrontSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, products: [], categories: [], suggestions: [], totalResults: 0 });
    }

    const rawQuery = q.trim();
    // Sanitize query to prevent regex injection attacks
    const sanitizedQuery = rawQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const searchRegex = { $regex: sanitizedQuery, $options: 'i' };

    // 1. Fetch matching active products (Up to 50 for in-memory ranking)
    const products = await Product.find({
      isActive: true,
      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { tags: searchRegex }
      ]
    })
      .populate('category', 'name slug isActive')
      .select('name slug images price finalPrice discountPercent tags category')
      .limit(50);

    // 2. Fetch active categories matching name
    const categories = await Category.find({
      isActive: true,
      name: searchRegex
    })
      .select('name slug productCount')
      .limit(30);

    // 3. Backend visibility filter: only show categories containing active products
    const [activeCategoryIds, activeSubcategoryIds] = await Promise.all([
      Product.distinct('category', { isActive: true }),
      Product.distinct('subcategory', { isActive: true })
    ]);

    const activeCatIdsSet = new Set([
      ...activeCategoryIds.map(id => id.toString()),
      ...activeSubcategoryIds.filter(id => id).map(id => id.toString())
    ]);

    const filteredCategories = categories.filter(cat => activeCatIdsSet.has(cat._id.toString()));

    // 4. In-Memory Relevance Ranking
    const qLower = rawQuery.toLowerCase();

    // Score products
    const scoredProducts = products.map(p => {
      let score = 0;
      const nameLower = p.name.toLowerCase();
      const brandLower = p.brand ? p.brand.toLowerCase() : '';

      if (nameLower === qLower) {
        score = 100; // Exact match
      } else if (nameLower.startsWith(qLower)) {
        score = 80; // Starts with
      } else if (nameLower.includes(qLower) || brandLower.includes(qLower)) {
        score = 60; // Partial match
      } else if (p.tags && p.tags.some(tag => tag.toLowerCase().includes(qLower))) {
        score = 40; // Tag match
      }
      return { product: p, score };
    });

    scoredProducts.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    const rankedProducts = scoredProducts.map(sp => sp.product);

    // Score categories
    const scoredCategories = filteredCategories.map(c => {
      let score = 0;
      const nameLower = c.name.toLowerCase();

      if (nameLower === qLower) {
        score = 100; // Exact match
      } else if (nameLower.startsWith(qLower)) {
        score = 80; // Starts with
      } else if (nameLower.includes(qLower)) {
        score = 60; // Partial match
      }
      return { category: c, score };
    });

    scoredCategories.sort((a, b) => b.score - a.score || a.category.name.localeCompare(b.category.name));
    const rankedCategories = scoredCategories.map(sc => sc.category);

    // 5. Autocomplete suggestions generator
    const suggestionsSet = new Set();

    // A. Matching Category Names (lowercased)
    for (const cat of rankedCategories) {
      suggestionsSet.add(cat.name.toLowerCase());
    }

    // B. Matching Product Tags
    for (const prod of rankedProducts) {
      for (const tag of (prod.tags || [])) {
        if (tag.toLowerCase().includes(qLower)) {
          suggestionsSet.add(tag.toLowerCase());
        }
      }
    }

    // C. Product Name Phrase Completions
    for (const prod of rankedProducts) {
      const nameLower = prod.name.toLowerCase();
      const words = nameLower.split(/\s+/);

      if (nameLower.startsWith(qLower)) {
        suggestionsSet.add(nameLower);
        if (words.length > 1) suggestionsSet.add(words.slice(0, 2).join(' '));
        if (words.length > 2) suggestionsSet.add(words.slice(0, 3).join(' '));
      } else {
        const matchIdx = words.findIndex(w => w.startsWith(qLower));
        if (matchIdx !== -1) {
          suggestionsSet.add(words.slice(matchIdx, matchIdx + 2).join(' '));
        }
      }
    }

    const suggestions = Array.from(suggestionsSet)
      .filter(s => s !== qLower && s.length >= qLower.length)
      .slice(0, 5);

    const finalProducts = rankedProducts.slice(0, 5);
    const finalCategories = rankedCategories.slice(0, 3);
    const totalResults = rankedProducts.length + rankedCategories.length;

    res.json({
      success: true,
      products: finalProducts,
      categories: finalCategories,
      suggestions,
      totalResults
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
