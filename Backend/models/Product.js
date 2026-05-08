const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  value: { type: String, required: true },
  sku:   { type: String, required: true },
  price: { type: Number, required: true },
  discountedPrice:   { type: Number, default: 0 },
  stock:             { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
});

const ProductSchema = new mongoose.Schema({
  name:             { type: String, required: [true, 'Product name is required'], trim: true },
  slug:             { type: String, unique: true, lowercase: true },
  description:      { type: String, default: '' },
  shortDescription: { type: String, default: '' },
  category:         { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategory:      { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  brand:            { type: String, default: '' },
  sku:              { type: String, unique: true, sparse: true },
  images:           [{ type: String }],

  // Pricing
  price:            { type: Number, required: true }, // Legacy field, kept for compatibility as basePrice
  basePrice:        { type: Number },                // Original price before discount/GST
  discountedPrice:  { type: Number, default: 0 },   // Legacy field
  discountPercent:  { type: Number, default: 0 },   // stored for display
  gstPercent:       { type: Number, default: 0 },   // GST % field from form
  finalPrice:       { type: Number },                // FINAL PER UNIT PRICE (after discount, incl. GST)
  hsnCode:          { type: String, default: '' },  // HSN code for taxation
  deliveryCharge:   { type: Number, default: 0 },

  // Inventory
  stock:             { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  batchNumber:       { type: String, default: '' },
  batches: [{
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 }
  }],
  variants:         [VariantSchema],

  // Metadata
  tags:             [{ type: String }],
  specifications:   [{ key: String, value: String }],
  weight:           { type: Number, default: 0 },
  weightUnit:       { type: String, default: 'kg' },
  dimensions:       { length: Number, width: Number, height: Number },

  // Status
  isActive:         { type: Boolean, default: true },
  isFeatured:       { type: Boolean, default: false },
  type:             { type: String, default: 'physical' }, // physical or digital
  totalSold:        { type: Number, default: 0 },
  rating:           { type: Number, default: 0 },
  totalReviews:     { type: Number, default: 0 },
}, { timestamps: true });

// Auto-generate slug and compute Final Price
ProductSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      + '-' + Date.now();
  }

  // PRICING ENGINE (BACKEND - SINGLE SOURCE OF TRUTH)
  const PricingEngine = require('../utils/pricingEngine');
  
  // Ensure basePrice is synced with price
  if (this.isModified('price')) {
    this.basePrice = this.price;
  } else if (this.isModified('basePrice')) {
    this.price = this.basePrice;
  }

  const unitPricing = PricingEngine.calculateUnitPricing(this);
  this.finalPrice = unitPricing.finalUnitPrice;
  this.discountedPrice = unitPricing.discountedUnitPrice;

  next();
});

module.exports = mongoose.model('Product', ProductSchema);
