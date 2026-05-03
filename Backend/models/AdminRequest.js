const mongoose = require('mongoose');

const AdminRequestSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  name: { type: String, required: [true, 'Name is required'] },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'verified', 'completed', 'rejected'], 
    default: 'pending' 
  },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'manager'], 
    default: 'admin' 
  },
  onboardingOtp: { type: String },
  onboardingOtpExpiry: { type: Date },
  otpType: { type: String, default: 'onboarding' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: { type: Date }
}, { timestamps: true });

AdminRequestSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('AdminRequest', AdminRequestSchema);
