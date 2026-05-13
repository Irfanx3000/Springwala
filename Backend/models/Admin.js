const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  role: { type: String, enum: ['superadmin', 'admin', 'manager'], default: 'admin' },
  avatar: { type: String, default: '' },
  
  // New Production-Grade Status Fields
  emailVerified: { type: Boolean, default: true }, // Default true for existing admins
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'approved' // Default approved for existing admins
  },
  accountStatus: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' // Default active for existing admins
  },

  // Legacy fields (kept for compatibility)
  isApproved: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  
  lastLogin: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date },
  otpType: { type: String, default: 'login' },
}, { timestamps: true });

// Hash password before saving
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
