const Product      = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');

// @desc  Get inventory list (products with stock info)
// @route GET /api/inventory
exports.getInventory = async (req, res) => {
  try {
    const { search, category, stockStatus, isActive, page = 1, limit = 20, sortBy = 'stock', order = 'asc' } = req.query;
    const query = {};

    if (search)   query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (category) query.category = category;
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    // Stock status filter using aggregation-compatible expressions
    if (stockStatus === 'out') {
      query.stock = 0;
    } else if (stockStatus === 'low') {
      // stock > 0 AND stock <= lowStockThreshold
      query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
    } else if (stockStatus === 'in') {
      // stock > lowStockThreshold
      query.$expr = { $gt: ['$stock', '$lowStockThreshold'] };
    }

    const skip   = (page - 1) * limit;
    const sortOp = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .select('name sku stock lowStockThreshold batchNumber price discountedPrice images isActive category updatedAt')
        .sort(sortOp)
        .skip(Number(skip))
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get inventory summary stats
// @route GET /api/inventory/stats
exports.getInventoryStats = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalProducts, outOfStock, lowStock, stockValue, inventoryAddedThisMonth] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: 0 }),
      Product.countDocuments({ $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] } }),
      Product.aggregate([{ $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$price'] } } } }]),
      InventoryLog.countDocuments({ type: 'stock_in', createdAt: { $gte: startOfMonth } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalProducts,
        outOfStock,
        lowStock,
        inStock: Math.max(0, totalProducts - outOfStock - lowStock),
        totalStockValue: stockValue[0]?.value || 0,
        inventoryAddedThisMonth
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update stock for a product
// @route PUT /api/inventory/:productId/stock
exports.updateStock = async (req, res) => {
  try {
    const { quantity, type, reason, reference, variantSku } = req.body;

    if (quantity === undefined || quantity === null || quantity === '') {
      return res.status(400).json({ success: false, message: 'Quantity is required' });
    }
    if (!['stock_in', 'stock_out', 'adjustment'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be: stock_in, stock_out, or adjustment' });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const previousStock = product.stock;
    let newStock;

    if (type === 'stock_in')   newStock = previousStock + Number(quantity);
    else if (type === 'stock_out') newStock = Math.max(0, previousStock - Number(quantity));
    else newStock = Number(quantity);   // adjustment = set directly

    product.stock = newStock;
    await product.save();

    const log = await InventoryLog.create({
      product: product._id,
      variantSku: variantSku || '',
      type,
      quantity: Number(quantity),
      previousStock,
      newStock,
      reason: reason || '',
      reference: reference || '',
      updatedBy: req.admin._id,
    });

    res.json({
      success: true,
      message: 'Stock updated successfully',
      product: { _id: product._id, name: product.name, stock: product.stock },
      log,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Bulk update stock for multiple products
// @route PUT /api/inventory/bulk-update
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || !updates.length) {
      return res.status(400).json({ success: false, message: 'Updates array is required' });
    }

    const results = { success: [], errors: [] };

    for (const update of updates) {
      try {
        const product = await Product.findById(update.productId);
        if (!product) { results.errors.push({ productId: update.productId, error: 'Product not found' }); continue; }

        const previousStock = product.stock;
        let newStock;
        if (update.type === 'stock_in')  newStock = previousStock + Number(update.quantity);
        else if (update.type === 'stock_out') newStock = Math.max(0, previousStock - Number(update.quantity));
        else newStock = Number(update.quantity);

        product.stock = newStock;
        await product.save();

        await InventoryLog.create({
          product: product._id,
          type: update.type || 'adjustment',
          quantity: Number(update.quantity),
          previousStock,
          newStock,
          reason: update.reason || 'Bulk update',
          updatedBy: req.admin._id,
        });

        results.success.push({ productId: update.productId, name: product.name, newStock });
      } catch (e) {
        results.errors.push({ productId: update.productId, error: e.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk update: ${results.success.length} updated, ${results.errors.length} errors`,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get all inventory logs (global)
// @route GET /api/inventory/logs
exports.getAllLogs = async (req, res) => {
  try {
    const { type, page = 1, limit = 30 } = req.query;
    const query = {};
    if (type) query.type = type;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      InventoryLog.find(query)
        .populate('product',   'name sku')
        .populate('updatedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      InventoryLog.countDocuments(query),
    ]);

    res.json({ success: true, total, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get logs for a single product
// @route GET /api/inventory/:productId/logs
exports.getInventoryLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      InventoryLog.find({ product: req.params.productId })
        .populate('updatedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      InventoryLog.countDocuments({ product: req.params.productId }),
    ]);

    res.json({ success: true, total, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
