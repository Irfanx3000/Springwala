const rateLimit = require('express-rate-limit');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Registration rate limiter
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// OTP verification rate limiter
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many OTP verification attempts. Please try again later.' },
});

// Resend OTP rate limiter
const resendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many resend attempts. Please wait before trying again.' },
});

// Forgot password rate limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
});

module.exports = {
  generalLimiter,
  registerLimiter,
  loginLimiter,
  otpLimiter,
  resendLimiter,
  forgotPasswordLimiter,
};