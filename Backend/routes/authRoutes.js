const express = require('express');
const passport = require('passport');
const router = express.Router();

const {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  googleCallback,
  googleSuccess,
  logout,
} = require('../controllers/authController');

const {
  registerLimiter,
  loginLimiter,
  otpLimiter,
  resendLimiter,
  forgotPasswordLimiter,
} = require('../middleware/rateLimiter');

// Public routes with rate limiting
router.post('/register', registerLimiter, register);
router.post('/verify-otp', otpLimiter, verifyOTP);
router.post('/resend-otp', resendLimiter, resendOTP);
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, resetPassword);
router.post('/logout', logout);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/api/auth/google/failure' }), googleCallback);
router.get('/google/success', googleSuccess);
router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, message: 'Google authentication failed' });
});

module.exports = router;