const { body, validationResult } = require('express-validator');

// Validation rules for registration
const validateRegister = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter'),
];

// Validation rules for login
const validateLogin = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
];

// Validation rules for OTP verification
const validateOTP = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('otp')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateOTP,
  handleValidationErrors,
};