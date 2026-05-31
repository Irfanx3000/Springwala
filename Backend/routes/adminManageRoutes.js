const express = require('express');
const router  = express.Router();
const { 
  getAllAdmins, 
  register, 
  sendOnboardingOTP, 
  verifyOnboardingOTP,
  toggleAdmin,
  deleteAdmin,
  getAdminRequests,
  approveAdminRequest,
  rejectAdminRequest,
  requestAccess,
  getRequestStatus,
  setPassword,
  login,
  sendLoginOTP,
  verifyLoginOTP
} = require('../controllers/adminAuthController');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, otpLimiter, resendLimiter } = require('../middleware/rateLimiter');

// Public Onboarding & Auth Routes
router.post('/login',            loginLimiter, login);
router.post('/send-login-otp',   resendLimiter, sendLoginOTP);
router.post('/verify-login-otp', otpLimiter, verifyLoginOTP);
router.post('/request-access',   requestAccess);
router.get('/request-status',  getRequestStatus);
router.post('/send-onboarding-otp',   resendLimiter, sendOnboardingOTP);
router.post('/verify-onboarding-otp', otpLimiter, verifyOnboardingOTP);
router.post('/set-password',   setPassword);

// Protected Admin Management routes (Superadmin only)
router.get('/requests',        protect, authorize('superadmin'), getAdminRequests);
router.post('/approve',        protect, authorize('superadmin'), approveAdminRequest);
router.post('/reject',         protect, authorize('superadmin'), rejectAdminRequest);

router.get('/all',             protect, authorize('superadmin'), getAllAdmins);
router.post('/create',         protect, authorize('superadmin'), register);
router.patch('/:id/toggle',    protect, authorize('superadmin'), toggleAdmin);
router.delete('/:id',          protect, authorize('superadmin'), deleteAdmin);

module.exports = router;
