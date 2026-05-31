const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  image: { type: String, required: true }, // Desktop Image
  mobileImage: { type: String, default: null }, // Mobile Image
  position: { type: Number, default: 0 },
  type: {
    type: String,
    enum: ['homepage', 'category', 'sub-category', 'promotional', 'features', 'advertisement', 'section', 'informational'],
    required: true,
  },
  link: { type: String, default: '' },
  altText: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
