const Product = require('../models/Product');
const Category = require('../models/Category');
const InventoryLog = require('../models/InventoryLog');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const AdmZip = require('adm-zip');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// @desc  Get all products with filters
// @route GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, isActive, isFeatured, stockStatus, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    const query = {};

    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku:  { $regex: search, $options: 'i' } },
      { brand:{ $regex: search, $options: 'i' } },
    ];
    if (category)  query.category = category;
    if (isActive  !== undefined) query.isActive   = isActive   === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';

    // Stock status filter
    if (stockStatus === 'out') query.stock = 0;
    else if (stockStatus === 'low')  query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
    else if (stockStatus === 'in')   query.$expr = { $gt: ['$stock', '$lowStockThreshold'] };

    const skip   = (page - 1) * limit;
    const sortOp = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [products, total, active, lowStock, outOfStock] = await Promise.all([
      Product.find(query)
        .populate('category',    'name')
        .populate('subcategory', 'name')
        .sort(sortOp)
        .skip(Number(skip))
        .limit(Number(limit)),
      Product.countDocuments(query),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: { $gt: 0 }, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
      Product.countDocuments({ stock: 0 })
    ]);

    res.json({ success: true, total, active, lowStock, outOfStock, page: Number(page), pages: Math.ceil(total / limit), products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get single product
// @route GET /api/products/:id
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category',    'name slug')
      .populate('subcategory', 'name slug');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Create product
// @route POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const {
      name, description, shortDescription, category, subcategory,
      brand, sku, price, discountedPrice, discountPercent, gstPercent, hsnCode,
      stock, lowStockThreshold, tags, specifications,
      weight, weightUnit, isFeatured, isActive, variants, batches,
    } = req.body;

    // Validate required
    if (!name)     return res.status(400).json({ success: false, message: 'Product name is required' });
    if (!category) return res.status(400).json({ success: false, message: 'Category is required' });
    if (!price)    return res.status(400).json({ success: false, message: 'Price is required' });

    const images = req.files ? req.files.map(f => `/uploads/products/${f.filename}`) : [];

    const product = await Product.create({
      name, description, shortDescription,
      category,
      subcategory: subcategory || null,
      brand, sku, images,
      price: Number(price),
      basePrice: Number(price),
      discountPercent: Number(discountPercent || 0),
      gstPercent: Number(gstPercent || 0),
      hsnCode: hsnCode || '',
      stock: Number(stock || 0),
      lowStockThreshold: Number(lowStockThreshold || 5),
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : [],
      specifications: specifications ? JSON.parse(specifications) : [],
      weight: Number(weight || 0),
      weightUnit: weightUnit || 'kg',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isActive:   isActive === 'false' ? false : true,
      variants:   variants ? JSON.parse(variants) : [],
      batches:    batches ? JSON.parse(batches) : [],
    });

    // Update category product count
    await Category.findByIdAndUpdate(category, { $inc: { productCount: 1 } });

    // Log initial stock
    if (Number(stock) > 0) {
      await InventoryLog.create({
        product: product._id,
        type: 'stock_in',
        quantity: Number(stock),
        previousStock: 0,
        newStock: Number(stock),
        reason: 'Initial stock on product creation',
        updatedBy: req.admin._id,
      });
    }

    res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    // Handle duplicate key (SKU already exists)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A product with this SKU already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update product
// @route PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const scalarFields = [
      'name','description','shortDescription','brand','sku','price', 'basePrice',
      'discountPercent','gstPercent','hsnCode','stock',
      'lowStockThreshold','weight','weightUnit','isFeatured','isActive','batchNumber','type', 'deliveryCharge',
    ];
    scalarFields.forEach(f => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    if (req.body.batches)        product.batches        = JSON.parse(req.body.batches);

    if (req.body.category)  product.category   = req.body.category;
    if (req.body.subcategory !== undefined) product.subcategory = req.body.subcategory || null;

    if (req.body.tags) {
      product.tags = Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (req.body.specifications) product.specifications = JSON.parse(req.body.specifications);
    if (req.body.variants)       product.variants       = JSON.parse(req.body.variants);

    // Handle images
    let images = product.images;
    if (req.body.existingImages) {
      images = JSON.parse(req.body.existingImages);
    }
    
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => `/uploads/products/${f.filename}`);
      images = [...images, ...newImages];
    }
    product.images = images;

    await product.save();
    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'SKU already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Delete product
// @route DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Remove image files from disk
    product.images.forEach(imgPath => {
      const fullPath = path.join(__dirname, '..', imgPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });

    // Decrease category count
    await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });
    await product.deleteOne();

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Delete a single product image
// @route DELETE /api/products/:id/image
exports.deleteProductImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl is required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.images = product.images.filter(img => img !== imageUrl);
    await product.save();

    // Delete file
    const filePath = path.join(__dirname, '..', imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true, message: 'Image deleted', images: product.images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Toggle product active/inactive
// @route PATCH /api/products/:id/toggle
exports.toggleProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.isActive = !product.isActive;
    await product.save();
    res.json({ success: true, message: `Product ${product.isActive ? 'activated' : 'deactivated'}`, isActive: product.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Bulk upload via CSV and optional ZIP
// @route POST /api/products/bulk-upload
exports.bulkUpload = async (req, res) => {
  let tempDir = null;
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, message: 'CSV file is required' });
    }

    const csvFile = req.files.file[0];
    const productsUploadDir = path.join(__dirname, '../uploads/products');
    if (!fs.existsSync(productsUploadDir)) fs.mkdirSync(productsUploadDir, { recursive: true });

    // 1. EXTRACT ZIP IF PROVIDED
    let extractedFiles = new Map(); // fileName -> buffer
    if (req.files.images) {
      const zipFile = req.files.images[0];
      try {
        const zip = new AdmZip(zipFile.buffer);
        const zipEntries = zip.getEntries();
        zipEntries.forEach(entry => {
          if (!entry.isDirectory) {
            const fileName = entry.entryName.split('/').pop().toLowerCase();
            if (fileName) extractedFiles.set(fileName, entry.getData());
          }
        });
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Failed to parse ZIP file', error: err.message });
      }
    }

    // 2. PARSE CSV
    const rows = [];
    const readable = new Readable();
    readable._read = () => {};
    readable.push(csvFile.buffer);
    readable.push(null);

    await new Promise((resolve, reject) => {
      readable.pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (!rows.length) return res.status(400).json({ success: false, message: 'CSV is empty' });

    // 3. PROCESS ROWS
    const results = { success: 0, failed: 0, errors: [], addedProducts: [] };
    const bulkOps = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1 for header, 0-indexed

      // Clean keys
      const data = {};
      for (let key in row) data[key.trim()] = row[key]?.trim();

      const { sku, name, unitPrice, discountPercent, gstPercent, image_names } = data;

      // Validation
      if (!sku || !name || !unitPrice) {
        results.errors.push({ row: rowIndex, message: 'SKU, Name, and unitPrice are mandatory' });
        results.failed++;
        continue;
      }

      // Batch Parsing (Support up to 10 batches)
      const batches = [];
      for (let b = 1; b <= 10; b++) {
        const qtyKey = `batch${b}_qty`;
        const priceKey = `batch${b}_price`;
        if (data[qtyKey] && data[priceKey]) {
          const bQty = parseInt(data[qtyKey]);
          const bPrice = parseFloat(data[priceKey]);
          if (!isNaN(bQty) && !isNaN(bPrice) && bQty > 0 && bPrice > 0) {
            batches.push({ quantity: bQty, price: bPrice });
          }
        }
      }

      if (batches.length === 0) {
        results.errors.push({ row: rowIndex, message: 'At least one valid batch (qty & price) is required' });
        results.failed++;
        continue;
      }

      // Image Mapping
      const productImages = [];
      if (image_names) {
        const targetImages = image_names.split('|').map(img => img.trim().toLowerCase()).filter(Boolean);
        for (const imgName of targetImages) {
          if (extractedFiles.has(imgName)) {
            // Save to /uploads/products/
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const cleanName = `${uniqueSuffix}-${imgName.replace(/\s+/g, '_')}`;
            const filePath = path.join(productsUploadDir, cleanName);
            fs.writeFileSync(filePath, extractedFiles.get(imgName));
            productImages.push(`/uploads/products/${cleanName}`);
          } else {
            // Log warning but don't fail
            console.warn(`Row ${rowIndex}: Image ${imgName} not found in ZIP`);
          }
        }
      }

      // Prepare Update/Upsert
      const updateData = {
        name,
        price: parseFloat(unitPrice),
        basePrice: parseFloat(unitPrice),
        discountPercent: parseFloat(discountPercent || 0),
        gstPercent: parseFloat(gstPercent || 0),
        batches,
        sku: sku.toString(),
        stock: batches.reduce((sum, b) => sum + b.quantity, 0),
        isActive: true
      };

      if (productImages.length > 0) updateData.images = productImages;

      bulkOps.push({
        updateOne: {
          filter: { sku: sku.toString() },
          update: { $set: updateData },
          upsert: true
        }
      });
      results.success++;
    }

    // 4. EXECUTE BULK
    let importSummary = { added: 0, updated: 0 };
    if (bulkOps.length > 0) {
      const bulkResult = await Product.bulkWrite(bulkOps);
      importSummary.added = bulkResult.upsertedCount;
      importSummary.updated = bulkResult.modifiedCount || (bulkResult.matchedCount - bulkResult.upsertedCount); 
      // Note: modifiedCount might be 0 if data is identical, so matchedCount is better for "Updated/Processed existing"
      
      // Get added products for response
      const skuList = bulkOps.map(op => op.updateOne.filter.sku);
      results.addedProducts = await Product.find({ sku: { $in: skuList } }, 'sku name price stock');
    }

    res.json({
      success: true,
      total: rows.length,
      successCount: results.success,
      addedCount: importSummary.added,
      updatedCount: bulkOps.length - importSummary.added, // Total successful - new = updated/existing
      failed: results.failed,
      errors: results.errors,
      addedProducts: results.addedProducts
    });

  } catch (err) {
    console.error('Bulk Upload Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// @desc  Bulk delete products
// @route POST /api/products/bulk-delete
exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No IDs provided' });

    // Delete associated images
    const products = await Product.find({ _id: { $in: ids } });
    for (const p of products) {
      if (p.images && p.images.length) {
        p.images.forEach(img => {
          const filePath = path.join(__dirname, '..', img);
          if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch(e) {}
        });
      }
    }

    await Product.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${ids.length} products deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, isActive } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No IDs provided' });

    await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive: isActive } }
    );

    res.json({ success: true, message: `${ids.length} products updated` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// @desc  Get public products (for user UI)
// @route GET /api/products/public
exports.getPublicProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
// ==============================
// PUBLIC PRODUCT APIs
// ==============================

// @desc Get latest products
// @route GET /api/products/latest
exports.getLatestProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.json({
      success: true,
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// @desc Get featured products
// @route GET /api/products/featured
exports.getFeaturedProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const products = await Product.find({
      isActive: true,
      isFeatured: true
    })
      .limit(limit)
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.json({
      success: true,
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// @desc Get top sold products
// @route GET /api/products/top-sold
exports.getTopSoldProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const products = await Product.find({
      isActive: true,
      totalSold: { $gt: 0 }
    })
      .sort({ totalSold: -1 })
      .limit(limit)
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.json({
      success: true,
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};