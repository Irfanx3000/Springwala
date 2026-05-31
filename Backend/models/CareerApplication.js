const mongoose = require('mongoose');

const CareerApplicationSchema = new mongoose.Schema({
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
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true
  },
  experience: {
    type: String,
    required: [true, 'Experience level is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Current location is required'],
    trim: true
  },
  resumeUrl: {
    type: String,
    required: [true, 'Resume file path is required']
  },
  resumeFileName: {
    type: String,
    required: [true, 'Resume file name is required']
  },
  coverLetter: {
    type: String,
    required: [true, 'Cover letter or message is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['New', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'],
    default: 'New'
  }
}, { timestamps: true });

module.exports = mongoose.model('CareerApplication', CareerApplicationSchema);
