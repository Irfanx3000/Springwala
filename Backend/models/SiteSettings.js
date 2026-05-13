const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema({
  // Singleton: only one document exists
  _singleton: { type: String, default: 'global', unique: true },

  // General Information
  siteName:      { type: String, default: 'Springwala' },
  contactEmail:  { type: String, default: 'support@springwala.in' },
  contactNumber: { type: String, default: '+91 8879 241085' },
  address:       { type: String, default: 'Mumbai, Maharashtra (India)' },

  // SEO
  metaTitle:       { type: String, default: 'Springwala | Your Industrial Store' },
  metaDescription: { type: String, default: 'Leading manufacturer of high-quality industrial springs and components in India.' },
  metaKeywords:    { type: String, default: 'springs, compression springs, industrial springs mumbai' },

  // Branding
  logoUrl:    { type: String, default: '' },
  faviconUrl: { type: String, default: '' },

  // Social Links
  instagram: { type: String, default: '' },
  facebook:  { type: String, default: '' },
  linkedin:  { type: String, default: '' },
  twitter:   { type: String, default: '' },
  whatsapp:  { type: String, default: '' },

  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);
