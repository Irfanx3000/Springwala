const mongoose = require('mongoose');

const PartnerApplicationSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  productCategory: {
    type: String,
    required: [true, 'Product category is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Under Review', 'Approved', 'Rejected'],
    default: 'New'
  }
}, { timestamps: true });

module.exports = mongoose.model('PartnerApplication', PartnerApplicationSchema);
