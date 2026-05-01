const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Category name is required'], trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  banner: { type: String, default: '' },
  description: { type: String, default: '' },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  productCount: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual: subcategories
CategorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
});

// Auto-generate slug
CategorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', CategorySchema);
