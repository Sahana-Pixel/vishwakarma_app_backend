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
 * Password strength validation
 * Min 8 chars, 1 number, 1 special character
 */
const passwordValidationRules = () => {
  return [
    body('password')
      .trim()
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .withMessage('Password must contain at least one number and one special character')
  ];
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
  ...passwordValidationRules(),
  body('securityQuestion')
    .trim()
    .notEmpty()
    .withMessage('Security question is required'),
  body('securityAnswer')
    .trim()
    .notEmpty()
    .withMessage('Security answer is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
];

/**
 * Validation rules for login request
 */
const loginValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Invalid phone number format. Must be +91XXXXXXXXXX'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation for checking phone existence
 */
const checkPhoneValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+91)?[6-9]\d{9}$/)
    .withMessage('Invalid Indian phone number.')
];

/**
 * Validation for verify question
 */
const verifyQuestionValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Invalid phone number format. Must be +91XXXXXXXXXX'),
  body('securityAnswer')
    .trim()
    .notEmpty()
    .withMessage('Security answer is required')
];

/**
 * Validation for reset password
 */
const resetPasswordValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  body('resetToken')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required'),
  ...passwordValidationRules(),
];

module.exports = {
  sendOtpValidation,
  verifyOtpValidation,
  registerUserValidation,
  handleValidationErrors,
  normalizePhone,
  loginValidation,
  checkPhoneValidation,
  verifyQuestionValidation,
  resetPasswordValidation
};
