const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Please provide a valid 10-digit phone number',
      },
    },
    password: {
      type: String,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return v.length >= 6;
        },
        message: 'Password must be at least 6 characters',
      },
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // isActive allows admins to block users via the admin panel
    isActive: {
      type: Boolean,
      default: true,
    },
    otpPreference: {
      type: String,
      enum: ['email', 'sms'],
      default: 'email',
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLogin: Date,
    // Order stats updated by userOrderController
    totalOrders: { type: Number, default: 0 },
    totalSpent:  { type: Number, default: 0 },

    // Extended Profile Fields
    alternatePhone: { type: String, trim: true },
    profileImage:   { type: String },
    country:        { type: String, trim: true },
    state:          { type: String, trim: true },

    companyProfile: {
      companyName: { type: String, trim: true },
      industry:    { type: String, trim: true },
      companyType: { type: String, trim: true },
      country:     { type: String, trim: true },
      state:       { type: String, trim: true },
      website:     { type: String, trim: true },
      email:       { type: String, trim: true, lowercase: true },
      phone:       { type: String, trim: true },
      address:     { type: String, trim: true },
    },

    gstin: {
      number: { type: String, trim: true },
      pan:    { type: String, trim: true },
    },

    billingAddress: {
      street:    { type: String, trim: true },
      apartment: { type: String, trim: true },
      city:      { type: String, trim: true },
      state:     { type: String, trim: true },
      country:   { type: String, trim: true },
      zip:       { type: String, trim: true },
      phone:     { type: String, trim: true },
    },

    shippingAddress: {
      street:    { type: String, trim: true },
      apartment: { type: String, trim: true },
      city:      { type: String, trim: true },
      state:     { type: String, trim: true },
      country:   { type: String, trim: true },
      zip:       { type: String, trim: true },
      phone:     { type: String, trim: true },
    },
    
    wishlist: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
  },
  { timestamps: true }
);

// Virtual: 'name' field for admin panel compatibility (adminUserController uses user.name)
userSchema.virtual('name').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual: 'phone' alias for admin panel compatibility (adminUserController uses user.phone)
userSchema.virtual('phone').get(function () {
  return this.phoneNumber || '';
});

userSchema.set('toJSON',   { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
