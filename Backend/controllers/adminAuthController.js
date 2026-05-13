const jwt   = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const OTP = require('../models/OTP');
const AdminRequest = require('../models/AdminRequest');
const otpService = require('../services/otpService');
const { sendOTPEmail } = require('../services/emailService');

const generateAdminToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// GET /api/admin/request-status?email=
exports.getRequestStatus = async (req, res) => {
  try {
    const email = req.query.email || req.body.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // 1. Check if an Admin record already exists (post-onboarding phase)
    const admin = await Admin.findOne({ email });
    if (admin) {
      if (admin.approvalStatus === 'approved' && admin.accountStatus === 'active') {
        return res.json({ success: true, status: 'completed', message: 'Account is fully active' });
      }
      if (admin.approvalStatus === 'pending') {
        return res.json({ success: true, status: 'pending_approval', message: 'Waiting for superadmin approval' });
      }
      if (admin.approvalStatus === 'rejected') {
        return res.json({ success: true, status: 'rejected', message: 'Request was rejected' });
      }
    }

    // 2. Check the Onboarding Request phase
    const request = await AdminRequest.findOne({ email });
    if (!request) return res.status(404).json({ success: false, message: 'No request found for this email' });

    res.json({ success: true, status: request.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/request-access
exports.requestAccess = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, message: 'Name and email are required' });

    // 1. Check if user is already an ACTIVE admin
    const admin = await Admin.findOne({ email });
    if (admin) {
      if (admin.approvalStatus === 'approved' && admin.accountStatus === 'active') {
        return res.status(400).json({ success: false, message: 'You are already an admin. Please login.' });
      }
      if (admin.approvalStatus === 'pending') {
        return res.status(400).json({ success: false, message: 'Your verified request is already pending approval.' });
      }
    }

    // 2. Check if there is an Onboarding Request in progress
    // We allow retrying the onboarding if they haven't set a password yet (Admin record not created or pending)

    // 3. Re-use or Create Request
    const otpCode = otpService.generateOTP();
    const request = await AdminRequest.findOneAndUpdate(
      { email },
      { 
        name, 
        status: 'pending', 
        reviewedBy: null, 
        reviewedAt: null, 
        onboardingOtp: otpCode, 
        onboardingOtpExpiry: new Date(Date.now() + 10 * 60 * 1000) 
      },
      { upsert: true, new: true }
    );

    // 4. Send OTP Immediately (Verified-First Flow)
    console.log("[OTP] Sending onboarding OTP to:", email, "Code:", otpCode);
    await sendOTPEmail(email, otpCode);

    res.json({ 
      success: true, 
      message: 'OTP sent to your email. Please verify to continue.',
      status: 'pending' // Still in onboarding phase
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/requests (Superadmin only)
exports.getAdminRequests = async (req, res) => {
  try {
    // Only show requests that have completed the onboarding (verified + password set)
    const requests = await AdminRequest.find({ status: 'completed' }).sort({ updatedAt: -1 });
    
    const enrichedRequests = await Promise.all(
      requests.map(async (r) => {
        const admin = await Admin.findOne({ email: r.email });
        return {
          ...r.toObject(),
          adminExists: !!admin,
          approvalStatus: admin ? admin.approvalStatus : 'n/a',
          accountStatus: admin ? admin.accountStatus : 'n/a'
        };
      })
    );

    // Filter to only show those still needing attention (pending or recently approved)
    // or just return all completed ones and let the UI handle it.
    // The requirement says "ONLY see verified onboarding requests".
    res.json({ success: true, requests: enrichedRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/approve (Superadmin only)
exports.approveAdminRequest = async (req, res) => {
  try {
    const { requestId, role, email } = req.body;
    
    // Approval now primarily happens on the Admin record
    // but we can still identify by requestId (AdminRequest ID) or email
    let targetEmail = email;
    if (requestId) {
      const request = await AdminRequest.findById(requestId);
      if (request) {
        targetEmail = request.email;
        request.status = 'completed';
        request.reviewedBy = req.admin._id;
        request.reviewedAt = new Date();
        await request.save();
      }
    }

    if (!targetEmail) return res.status(400).json({ success: false, message: 'Email or Request ID is required' });

    const admin = await Admin.findOne({ email: targetEmail });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found for this request' });

    admin.approvalStatus = 'approved';
    admin.accountStatus = 'active';
    admin.isApproved = true; // Legacy support
    admin.isActive = true;   // Legacy support
    admin.role = role || admin.role || 'admin';
    await admin.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Admin approved successfully. They can now login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/reject-request (Superadmin only)
exports.rejectAdminRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await AdminRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    request.status = 'rejected';
    request.reviewedBy = req.admin._id;
    request.reviewedAt = new Date();
    await request.save();

    // Also update Admin record if it exists
    await Admin.findOneAndUpdate(
      { email: request.email },
      { approvalStatus: 'rejected', isApproved: false }
    );

    res.json({ success: true, message: 'Admin request rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    
    // NEW HARDENED VALIDATION
    if (!admin.emailVerified)
      return res.status(403).json({ success: false, message: 'Email not verified' });

    if (admin.approvalStatus === 'pending')
      return res.status(403).json({ success: false, message: 'Your account is pending superadmin approval' });

    if (admin.approvalStatus === 'rejected')
      return res.status(403).json({ success: false, message: 'Your access request was rejected' });
      
    if (admin.accountStatus !== 'active' || !admin.isActive)
      return res.status(401).json({ success: false, message: 'Account is deactivated' });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = generateAdminToken(admin._id);
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, avatar: admin.avatar },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/send-login-otp
exports.sendLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found' });
    if (!admin.isApproved) return res.status(403).json({ success: false, message: 'Account pending approval' });
    if (!admin.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });

    const otpCode = otpService.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    admin.loginOtp = otpCode;
    admin.loginOtpExpiry = expiresAt;
    admin.otpType = 'login';
    await admin.save({ validateBeforeSave: false });

    console.log("[OTP] Sending login OTP to:", email);
    await sendOTPEmail(email, otpCode);
    res.json({ success: true, message: 'Login OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/verify-login-otp
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.loginOtp) return res.status(400).json({ success: false, message: 'OTP not found or expired' });

    if (admin.loginOtpExpiry < new Date()) {
      admin.loginOtp = undefined;
      admin.loginOtpExpiry = undefined;
      await admin.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (admin.loginOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    admin.lastLogin = new Date();
    admin.loginOtp = undefined;
    admin.loginOtpExpiry = undefined;
    await admin.save({ validateBeforeSave: false });

    const token = generateAdminToken(admin._id);
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, avatar: admin.avatar },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/send-onboarding-otp
exports.sendOnboardingOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const request = await AdminRequest.findOne({ email });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'approved') return res.status(400).json({ success: false, message: 'Request not approved yet' });

    const otpCode = otpService.generateOTP();
    request.onboardingOtp = otpCode;
    request.onboardingOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    request.otpType = 'onboarding';
    await request.save();

    console.log("[OTP] Sending onboarding OTP to:", email);
    await sendOTPEmail(email, otpCode);
    res.json({ success: true, message: 'Onboarding OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/verify-onboarding-otp
exports.verifyOnboardingOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const request = await AdminRequest.findOne({ email });
    if (!request || !request.onboardingOtp) return res.status(400).json({ success: false, message: 'OTP not found' });

    if (request.onboardingOtpExpiry < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });
    if (request.onboardingOtp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });

    request.status = 'verified';
    request.onboardingOtp = undefined;
    request.onboardingOtpExpiry = undefined;
    await request.save();

    res.json({ success: true, message: 'Onboarding OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/set-password
exports.setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const request = await AdminRequest.findOne({ email });
    if (!request || request.status !== 'verified') 
      return res.status(400).json({ success: false, message: 'Unauthorized: OTP verification required first' });

    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    // 1. Create/Update Admin in VERIFIED_PENDING state
    await Admin.findOneAndUpdate(
      { email },
      {
        name: request.name,
        email: request.email,
        password,
        role: request.role || 'admin',
        emailVerified: true,
        approvalStatus: 'pending',
        accountStatus: 'inactive',
        isApproved: false, // Legacy support
        isActive: false    // Legacy support
      },
      { upsert: true, new: true, runValidators: true }
    );

    // 2. Update Request Status
    request.status = 'completed';
    await request.save();

    res.json({ 
      success: true, 
      message: 'Password set successfully. Your request is now waiting for Superadmin approval.',
      status: 'pending_approval'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/admin/me
exports.getMe = async (req, res) => {
  res.json({ success: true, admin: req.admin });
};

// GET /api/admin/all (superadmin only)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/:id/toggle (superadmin only)
exports.toggleAdmin = async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) 
      return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    
    admin.isActive = !admin.isActive;
    await admin.save();
    res.json({ success: true, message: `Admin ${admin.isActive ? 'activated' : 'deactivated'}`, isActive: admin.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/:id (superadmin only)
exports.deleteAdmin = async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) 
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    
    await admin.deleteOne();
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/create (superadmin only)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await Admin.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: 'Admin already exists with this email' });

    const finalPassword = password || crypto.randomBytes(12).toString('hex');

    const admin = await Admin.create({ name, email, password: finalPassword, role, isApproved: true });
    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/admin/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+password');
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
