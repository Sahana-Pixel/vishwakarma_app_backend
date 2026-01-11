/**
 * Input Validation Middleware
 * Using express-validator for request validation
 */

const { body, validationResult } = require('express-validator');

/**
 * Validation rules for send OTP request
 * Accepts Indian phone numbers only (+91, 10 digits)
 */
const sendOtpValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+91)?[6-9]\d{9}$/)
    .withMessage('Invalid Indian phone number. Must start with 6-9 and be 10 digits.')
];

/**
 * Validation rules for verify OTP request
 */
const verifyOtpValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Invalid phone number format. Must be +91XXXXXXXXXX'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('OTP must contain only digits')
];

/**
 * Middleware to handle validation errors
 * Returns standardized error response
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Get first error message for clean response
    const firstError = errors.array()[0];
    
    return res.status(400).json({
      success: false,
      message: firstError.msg
    });
  }
  
  next();
};

/**
 * Normalize phone number to E.164 format (+919876543210)
 */
const normalizePhone = (req, res, next) => {
  let phone = req.body.phone;
  
  if (phone) {
    // Remove all non-digits except leading +
    phone = phone.replace(/[^\d+]/g, '');
    
    // Add +91 if not present
    if (!phone.startsWith('+91')) {
      if (phone.startsWith('91') && phone.length === 12) {
        phone = '+' + phone;
      } else if (phone.length === 10) {
        phone = '+91' + phone;
      }
    }
    
    req.body.phone = phone;
  }
  
  next();
};

/**
 * Validation rules for register user request
 */
const registerUserValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Invalid phone number format. Must be +91XXXXXXXXXX'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
];

module.exports = {
  sendOtpValidation,
  verifyOtpValidation,
  registerUserValidation,
  handleValidationErrors,
  normalizePhone
};
