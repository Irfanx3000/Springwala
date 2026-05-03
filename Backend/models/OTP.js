const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  identifier: { type: String, required: true },  // email or phone
  otp:        { type: String, required: true },
  type:       { type: String, enum: ['email', 'sms'], default: 'email' },
  purpose:    { type: String, enum: ['register', 'forgot-password', 'admin-login'], default: 'register' },
  attempts:   { type: Number, default: 0 },
  expiresAt:  { type: Date, required: true },
  verified:   { type: Boolean, default: false },
}, { timestamps: true });

// Auto-expire documents via MongoDB TTL index
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', OTPSchema);
