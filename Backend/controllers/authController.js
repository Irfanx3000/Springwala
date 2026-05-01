const crypto = require('crypto');
const User = require('../models/User');
const otpService = require('../services/otpService');
const { sendOTPEmail, sendPasswordResetEmail } = require('../services/emailService');
const {
  storeTempUser,
  getTempUser,
  deleteTempUser,
  isExpired,
  canResend,
  incrementAttempts,
} = require('../services/tempUserStore');
const generateToken = require('../utils/generateToken');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * REGISTER - Send OTP based on user preference
 */
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phoneNumber, otpPreference = 'email', password } = req.body;

    // Validation
    if (!firstName || !lastName || !password) {
      throw new AppError('First name, last name, and password are required', 400);
    }

    if (!email && !phoneNumber) {
      throw new AppError('Either email or phone number is required', 400);
    }

    if (email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Please provide a valid email address', 400);
      }
    }

    if (phoneNumber) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        throw new AppError('Please provide a valid 10-digit phone number', 400);
      }
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // Check if user already exists
    let existingUser = null;
    if (email) existingUser = await User.findOne({ email: email.toLowerCase() });
    if (!existingUser && phoneNumber) existingUser = await User.findOne({ phoneNumber });

    if (existingUser) {
      throw new AppError('User already exists with this email or phone number', 400);
    }

    // Determine identifier and check rate limiting
    const identifier = email || phoneNumber;
    const existingTemp = getTempUser(identifier);
    if (existingTemp && !isExpired(existingTemp)) {
      throw new AppError('Please wait 5 minutes before trying again', 429);
    }

    // Determine delivery channel based on preference AND availability
    let channel = otpPreference;
    if (channel === 'email' && !email) channel = 'sms';
    if (channel === 'sms' && !phoneNumber) channel = 'email';

    if ((channel === 'email' && !email) || (channel === 'sms' && !phoneNumber)) {
      throw new AppError(`Cannot send OTP via ${channel}. Please provide ${channel === 'email' ? 'email' : 'phone number'}.`, 400);
    }

    // Generate OTP
    const otpCode = otpService.generateOTP();

    // Send OTP based on channel
    let otpSent = false;
    if (channel === 'email' && email) {
      await sendOTPEmail(email, otpCode);
      otpSent = true;
      console.log(`✅ OTP sent via EMAIL to ${email}`);
    } else if (channel === 'sms' && phoneNumber) {
      await otpService.sendOTPSMS(phoneNumber, otpCode);
      otpSent = true;
      console.log(`✅ OTP sent via SMS to ${phoneNumber}`);
    }

    if (!otpSent) {
      throw new AppError('Unable to send OTP. Please try again.', 500);
    }

    // Store temporary user data
    storeTempUser(identifier, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email ? email.toLowerCase() : null,
      phoneNumber: phoneNumber || null,
      password,
      otp: otpCode,
      channel,
      otpExpiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: `OTP sent via ${channel.toUpperCase()}`,
      channel,
      identifier,
      ...(process.env.NODE_ENV === 'development' && { devOTP: otpCode }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * VERIFY OTP
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      throw new AppError('Identifier and OTP are required', 400);
    }

    const tempUser = getTempUser(identifier);

    if (!tempUser) {
      throw new AppError('OTP expired or not found. Please register again.', 400);
    }

    if (Date.now() > tempUser.otpExpiresAt) {
      deleteTempUser(identifier);
      throw new AppError('OTP has expired. Please register again.', 400);
    }

    const remainingAttempts = incrementAttempts(tempUser);
    if (tempUser.attempts > tempUser.maxAttempts) {
      deleteTempUser(identifier);
      throw new AppError('Too many failed attempts. Please register again.', 429);
    }

    if (tempUser.otp !== otp) {
      throw new AppError(`Invalid OTP. ${remainingAttempts} attempts remaining.`, 400);
    }

    // Check if user already exists
    let existingUser = null;
    if (tempUser.email) existingUser = await User.findOne({ email: tempUser.email });
    if (!existingUser && tempUser.phoneNumber) existingUser = await User.findOne({ phoneNumber: tempUser.phoneNumber });

    if (existingUser) {
      deleteTempUser(identifier);
      throw new AppError('Account already exists. Please login.', 400);
    }

    // Create user
    const userData = {
      firstName: tempUser.firstName,
      lastName: tempUser.lastName,
      password: tempUser.password,
      isVerified: true,
      otpPreference: tempUser.channel,
    };

    if (tempUser.email) userData.email = tempUser.email;
    if (tempUser.phoneNumber) userData.phoneNumber = tempUser.phoneNumber;

    const user = await User.create(userData);
    deleteTempUser(identifier);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account verified successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * RESEND OTP
 */
const resendOTP = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      throw new AppError('Identifier is required', 400);
    }

    const tempUser = getTempUser(identifier);

    if (!tempUser) {
      throw new AppError('Session expired. Please register again.', 400);
    }

    if (!canResend(tempUser)) {
      const waitTime = Math.ceil((tempUser.lastSent + 60 * 1000 - Date.now()) / 1000);
      throw new AppError(`Please wait ${waitTime} seconds before requesting another OTP`, 429);
    }

    const newOTP = otpService.generateOTP();

    // Resend via same channel
    if (tempUser.channel === 'email' && tempUser.email) {
      await sendOTPEmail(tempUser.email, newOTP);
    } else if (tempUser.channel === 'sms' && tempUser.phoneNumber) {
      await otpService.sendOTPSMS(tempUser.phoneNumber, newOTP);
    }

    // Update temp user
    tempUser.otp = newOTP;
    tempUser.lastSent = Date.now();
    tempUser.otpExpiresAt = Date.now() + 5 * 60 * 1000;
    tempUser.attempts = 0;

    storeTempUser(identifier, tempUser);

    res.status(200).json({
      success: true,
      message: `New OTP sent via ${tempUser.channel.toUpperCase()}`,
      channel: tempUser.channel,
      ...(process.env.NODE_ENV === 'development' && { devOTP: newOTP }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * LOGIN - Supports both email and phone
 */
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      throw new AppError('Email/Phone and password are required', 400);
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.password) {
      throw new AppError('This account uses Google Sign-In. Please use Google login.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isVerified) {
      throw new AppError('Please verify your account before logging in', 403);
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * FORGOT PASSWORD
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      throw new AppError('Email or phone number is required', 400);
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phoneNumber: identifier }],
    });

    if (!user || !user.password) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL;
    const resetUrl = `${clientUrl}/reset-password.html?token=${resetToken}&email=${user.email}`;

    if (user.email) {
      await sendPasswordResetEmail(user.email, resetUrl, user.firstName);
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * RESET PASSWORD
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      throw new AppError('Token, email, and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const jwtToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token: jwtToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GOOGLE OAUTH CALLBACK
 */
const googleCallback = (req, res) => {
  const token = generateToken(req.user._id);
  const clientUrl = process.env.CLIENT_URL;
  res.redirect(`${clientUrl}/index.html?token=${token}`);
};

const googleSuccess = (req, res) => {
  if (req.user) {
    res.json({ success: true, user: req.user });
  } else {
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  googleCallback,
  googleSuccess,
  logout,
};