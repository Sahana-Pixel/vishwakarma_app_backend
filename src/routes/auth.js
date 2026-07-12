/**
 * Authentication Routes
 * Handles phone verification, password auth, and OTP recovery
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { sendOTP, verifyOTP, parseTwilioError } = require('../services/twilioService');
const { otpRateLimiter } = require('../middleware/rateLimiter');
const { generateToken, generateResetToken, verifyToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const { 
  sendOtpValidation,
  verifyOtpValidation,
  registerUserValidation,
  handleValidationErrors, 
  normalizePhone,
  loginValidation,
  checkPhoneValidation,
  verifyQuestionValidation,
  resetPasswordValidation
} = require('../middleware/validators');

const router = express.Router();

/**
 * POST /api/auth/check-phone
 * Checks if a phone number is already registered
 */
router.post(
  '/check-phone',
  normalizePhone,
  checkPhoneValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone } = req.body;
      const user = await User.findOne({ phone });
      
      if (user) {
        return res.status(400).json({
          success: false,
          exists: true,
          securityQuestion: user.securityQuestion,
          message: 'Account already exists'
        });
      }

      return res.status(200).json({
        success: true,
        exists: false,
        message: 'Phone number available'
      });
    } catch (error) {
      console.error('[AUTH] Check phone error:', error.message);
      next(error);
    }
  }
);

/**
 * POST /api/auth/signup
 * Create new user in database with password and security details
 */
router.post(
  '/signup',
  normalizePhone,
  registerUserValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const userData = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ phone: userData.phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Hash security answer
      const hashedSecurityAnswer = await bcrypt.hash(userData.securityAnswer.toLowerCase().trim(), salt);

      // Parse coordinates if provided
      let location = null;
      if (userData.latitude !== undefined && userData.longitude !== undefined && userData.latitude !== null && userData.longitude !== null) {
        location = {
          type: 'Point',
          coordinates: [parseFloat(userData.longitude), parseFloat(userData.latitude)]
        };
      }

      // Create new user
      const user = new User({
        ...userData,
        password: hashedPassword,
        securityAnswer: hashedSecurityAnswer,
        dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
        numberOfChildren: userData.numberOfChildren ? parseInt(userData.numberOfChildren) : null,
        location,
        isProfileComplete: true
      });

      await user.save();
      console.log(`[SIGNUP] New user created: ${user._id} - ${user.name}`);

      // Generate JWT token
      const token = generateToken(user._id.toString(), user.phone);

      return res.status(201).json({
        success: true,
        token
      });

    } catch (error) {
      console.error('[SIGNUP] Error:', error.message);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        return res.status(400).json({
          success: false,
          message: messages.join(', ')
        });
      }
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user with phone and password
 */
router.post(
  '/login',
  normalizePhone,
  loginValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone, password } = req.body;

      const user = await User.findOne({ phone });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Soft migration support: If password doesn't exist, force password reset
      if (!user.password) {
        return res.status(403).json({
          success: false,
          needsReset: true,
          message: 'Please reset your password using Forgot Password'
        });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = generateToken(user._id.toString(), phone);

      return res.status(200).json({
        success: true,
        token
      });

    } catch (error) {
      console.error('[LOGIN] Error:', error.message);
      next(error);
    }
  }
);

/**
 * POST /api/auth/verify-question
 * Verify security question for forgot password flow
 */
router.post(
  '/verify-question',
  normalizePhone,
  verifyQuestionValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone, securityAnswer } = req.body;

      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Phone number not found'
        });
      }

      if (!user.securityAnswer) {
         return res.status(400).json({
           success: false,
           message: 'Security question not set. Please use OTP.'
         });
      }

      // Compare security answer
      const isMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.securityAnswer);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect security answer'
        });
      }

      // Generate a short-lived reset token
      const resetToken = generateResetToken(user._id.toString(), phone);

      return res.status(200).json({
        success: true,
        resetToken
      });

    } catch (error) {
      console.error('[VERIFY_QUESTION] Error:', error.message);
      next(error);
    }
  }
);

/**
 * POST /api/auth/send-otp
 * Send OTP for forgot password
 */
router.post(
  '/send-otp',
  normalizePhone,
  sendOtpValidation,
  handleValidationErrors,
  otpRateLimiter,
  async (req, res, next) => {
    try {
      const { phone } = req.body;
      
      const user = await User.findOne({ phone });
      if (!user) {
         return res.status(400).json({
          success: false,
          message: 'Phone number not found'
        });
      }

      console.log(`[OTP] Sending OTP to ${phone.slice(0, 6)}****${phone.slice(-2)}`);
      const result = await sendOTP(phone);

      if (result.status === 'pending') {
        return res.status(200).json({
          success: true,
          message: 'OTP sent successfully'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });

    } catch (error) {
      console.error('[OTP] Error:', error.message);
      if (error.code || error.status) {
        const message = parseTwilioError(error);
        return res.status(400).json({ success: false, message });
      }
      if (error.message.includes('not configured')) {
        return res.status(500).json({ success: false, message: 'SMS service not configured' });
      }
      next(error);
    }
  }
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP for forgot password flow
 */
router.post(
  '/verify-otp',
  verifyOtpValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone, otp } = req.body;

      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Phone number not found'
        });
      }

      console.log(`[OTP] Verifying OTP for ${phone.slice(0, 6)}****${phone.slice(-2)}`);
      const result = await verifyOTP(phone, otp);

      if (!result.valid || result.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      // Generate a short-lived reset token
      const resetToken = generateResetToken(user._id.toString(), phone);

      return res.status(200).json({
        success: true,
        resetToken
      });

    } catch (error) {
      console.error('[OTP] Verification error:', error.message);
      if (error.code || error.status) {
        const message = parseTwilioError(error);
        return res.status(400).json({ success: false, message });
      }
      if (error.message.includes('not configured')) {
        return res.status(500).json({ success: false, message: 'SMS service not configured' });
      }
      next(error);
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 */
router.post(
  '/reset-password',
  normalizePhone,
  resetPasswordValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone, password, resetToken } = req.body;

      // Verify the reset token
      let decoded;
      try {
        decoded = verifyToken(resetToken);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired reset session. Please try again.'
        });
      }

      if (decoded.phone !== phone || !decoded.isResetToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid reset token'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update user password
      await User.findOneAndUpdate(
        { phone },
        { password: hashedPassword }
      );

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('[RESET_PASSWORD] Error:', error.message);
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current logged-in user details
 */
router.get(
  '/me',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user;
      const user = await User.findById(userId).select('-__v -password -securityAnswer');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        user: user.toObject()
      });

    } catch (error) {
      console.error('[AUTH] Get user error:', error.message);
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }
      next(error);
    }
  }
);

/**
 * PUT /api/auth/update-profile
 * Update logged-in user profile
 */
router.put(
  '/update-profile',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user;
      const updateData = { ...req.body };
      
      // Parse coordinates if provided
      if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
        if (updateData.latitude !== null && updateData.longitude !== null) {
          updateData.location = {
            type: 'Point',
            coordinates: [parseFloat(updateData.longitude), parseFloat(updateData.latitude)]
          };
        } else {
          updateData.location = null;
        }
        delete updateData.latitude;
        delete updateData.longitude;
      }
      
      // Prevent updating sensitive fields
      delete updateData.phone;
      delete updateData._id;
      delete updateData.password;
      delete updateData.securityQuestion;
      delete updateData.securityAnswer;
      delete updateData.__v;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.joinedDate;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }
      
      if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-__v -password -securityAnswer');
      
      if (!user) {
         return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      return res.status(200).json({
        success: true,
        user: user.toObject()
      });
      
    } catch (error) {
      console.error('[UPDATE] Profile update error:', error.message);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message).join(', ');
        return res.status(400).json({ success: false, message: `Validation error: ${messages}` });
      }
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }
      next(error);
    }
  }
);

module.exports = router;
