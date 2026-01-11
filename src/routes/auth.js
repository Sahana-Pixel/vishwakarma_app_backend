/**
 * Authentication Routes
 * Handles OTP sending and verification via Twilio Verify
 */

const express = require('express');
const { sendOTP, verifyOTP, parseTwilioError } = require('../services/twilioService');
const { otpRateLimiter } = require('../middleware/rateLimiter');
const { generateToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const { 
  sendOtpValidation,
  verifyOtpValidation,
  registerUserValidation,
  handleValidationErrors, 
  normalizePhone 
} = require('../middleware/validators');

const router = express.Router();

/**
 * POST /api/auth/send-otp
 * Send OTP to Indian phone number
 * 
 * Request body:
 * {
 *   "phone": "9876543210" or "+919876543210"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "OTP sent successfully"
 * }
 */
router.post(
  '/send-otp',
  normalizePhone,           // Normalize phone to +91XXXXXXXXXX
  sendOtpValidation,        // Validate phone format
  handleValidationErrors,   // Handle validation errors
  otpRateLimiter,           // Apply rate limiting
  async (req, res, next) => {
    try {
      const { phone } = req.body;

      console.log(`[OTP] Sending OTP to ${phone.slice(0, 6)}****${phone.slice(-2)}`);

      // Send OTP via Twilio Verify
      const result = await sendOTP(phone);

      // Check if verification was initiated
      if (result.status === 'pending') {
        return res.status(200).json({
          success: true,
          message: 'OTP sent successfully'
        });
      }

      // Unexpected status
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });

    } catch (error) {
      console.error('[OTP] Error:', error.message);

      // Handle Twilio-specific errors
      if (error.code || error.status) {
        const message = parseTwilioError(error);
        return res.status(400).json({
          success: false,
          message
        });
      }

      // Handle configuration errors
      if (error.message.includes('not configured')) {
        return res.status(500).json({
          success: false,
          message: 'SMS service not configured'
        });
      }

      // Pass to global error handler
      next(error);
    }
  }
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return JWT token
 * 
 * Request body:
 * {
 *   "phone": "+919876543210",
 *   "otp": "123456"
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "token": "jwt_token_here",
 *   "isNewUser": true/false
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "message": "Invalid OTP"
 * }
 */
router.post(
  '/verify-otp',
  verifyOtpValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { phone, otp } = req.body;

      console.log(`[OTP] Verifying OTP for ${phone.slice(0, 6)}****${phone.slice(-2)}`);

      // Verify OTP via Twilio
      const result = await verifyOTP(phone, otp);

      // Check if OTP is valid
      if (!result.valid || result.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      // Check if user exists in database (DO NOT create user yet)
      const user = await User.findOne({ phone });
      const isNewUser = !user;

      if (user) {
        console.log(`[OTP] Existing user found: ${user._id}`);
        // Generate JWT token for existing user
        const token = generateToken(user._id.toString(), phone);
        return res.status(200).json({
          success: true,
          token,
          isNewUser: false
        });
      } else {
        console.log(`[OTP] New user - phone verified, awaiting registration`);
        // For new users, we don't generate a token yet
        // User will get token after completing registration
        // Return success with isNewUser flag, no token needed for now
        return res.status(200).json({
          success: true,
          isNewUser: true
        });
      }

    } catch (error) {
      console.error('[OTP] Verification error:', error.message);

      // Handle Twilio-specific errors
      if (error.code || error.status) {
        const message = parseTwilioError(error);
        return res.status(400).json({
          success: false,
          message
        });
      }

      // Handle configuration errors
      if (error.message.includes('not configured')) {
        return res.status(500).json({
          success: false,
          message: 'SMS service not configured'
        });
      }

      // Pass to global error handler
      next(error);
    }
  }
);

/**
 * POST /api/auth/register-user
 * Create new user in database with provided details
 * 
 * Request body:
 * {
 *   "phone": "+919876543210",
 *   "name": "John Doe",
 *   "gender": "Male",
 *   "aadhaar": "123456789012",
 *   "fatherName": "Father Name",
 *   "motherName": "Mother Name",
 *   "relationshipWithHead": "Self",
 *   "gothra": "Bharadwaj",
 *   "dateOfBirth": "1990-01-01T00:00:00.000Z",
 *   "education": "Graduate",
 *   "upanayana": true,
 *   "maritalStatus": "Married",
 *   "numberOfChildren": 2,
 *   "occupation": "Self-Employed",
 *   "occupationDetails": "Goldsmith",
 *   "annualIncome": "5-10 Lakhs",
 *   "taxPayer": true,
 *   "houseType": "Own",
 *   "residenceAddress": "123 Street, City",
 *   "familyHouse": "Yes",
 *   "rationCardType": "BPL",
 *   "specialPerson": false
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "token": "jwt_token_here"
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "message": "Error message"
 * }
 */
router.post(
  '/register-user',
  normalizePhone,
  registerUserValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const {
        phone,
        name,
        gender,
        aadhaar,
        fatherName,
        motherName,
        relationshipWithHead,
        gothra,
        dateOfBirth,
        education,
        upanayana,
        maritalStatus,
        numberOfChildren,
        occupation,
        occupationDetails,
        annualIncome,
        taxPayer,
        houseType,
        residenceAddress,
        familyHouse,
        rationCardType,
        specialPerson
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Create new user
      const user = new User({
        phone,
        name,
        gender,
        aadhaar,
        fatherName,
        motherName,
        relationshipWithHead,
        gothra,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        education,
        upanayana,
        maritalStatus,
        numberOfChildren: numberOfChildren ? parseInt(numberOfChildren) : null,
        occupation,
        occupationDetails,
        annualIncome,
        taxPayer,
        houseType,
        residenceAddress,
        familyHouse,
        rationCardType,
        specialPerson,
        isProfileComplete: true
      });

      await user.save();
      console.log(`[REGISTER] New user created: ${user._id} - ${name}`);

      // Generate JWT token
      const token = generateToken(user._id.toString(), phone);

      // Return success response
      return res.status(201).json({
        success: true,
        token
      });

    } catch (error) {
      console.error('[REGISTER] Error:', error.message);

      // Handle duplicate key error (phone already exists)
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        return res.status(400).json({
          success: false,
          message: messages.join(', ')
        });
      }

      // Pass to global error handler
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current logged-in user details
 * Protected route - requires JWT authentication
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "user": {
 *     "_id": "...",
 *     "phone": "+919876543210",
 *     "name": "John Doe",
 *     "email": "...",
 *     "gender": "...",
 *     ...
 *   }
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "message": "Error message"
 * }
 */
router.get(
  '/me',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user;

      // Fetch user from database
      const user = await User.findById(userId).select('-__v');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Convert user to plain object and remove sensitive data if needed
      const userObject = user.toObject();

      // Return user details
      return res.status(200).json({
        success: true,
        user: userObject
      });

    } catch (error) {
      console.error('[AUTH] Get user error:', error.message);

      // Handle invalid ObjectId
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      // Pass to global error handler
      next(error);
    }
  }
);

/**
 * PUT /api/auth/update-profile
 * Update logged-in user profile
 * Protected route - requires JWT authentication
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * Content-Type: application/json
 * 
 * Request body (all fields optional except phone cannot be changed):
 * {
 *   "name": "Updated Name",
 *   "email": "updated@example.com",
 *   "gender": "Male",
 *   "aadhaar": "123456789012",
 *   "fatherName": "Father Name",
 *   "motherName": "Mother Name",
 *   "relationshipWithHead": "Self",
 *   "gothra": "Gothra Name",
 *   "dateOfBirth": "1990-01-01T00:00:00.000Z",
 *   "education": "Graduate",
 *   "upanayana": true,
 *   "maritalStatus": "Married",
 *   "numberOfChildren": 2,
 *   "occupation": "Self-Employed",
 *   "occupationDetails": "Details",
 *   "annualIncome": "500000-1000000",
 *   "taxPayer": true,
 *   "houseType": "Owned",
 *   "residenceAddress": "Address",
 *   "familyHouse": "Yes",
 *   "rationCardType": "BPL",
 *   "specialPerson": false
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "user": { ...updatedUser }
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "message": "Error message"
 * }
 */
router.put(
  '/update-profile',
  authenticate,
  async (req, res, next) => {
    try {
      const { userId } = req.user;
      
      // Get update data from request body
      const updateData = { ...req.body };
      
      // Remove phone from update data (phone cannot be changed)
      if (updateData.phone) {
        delete updateData.phone;
        console.log('[UPDATE] Phone change attempted, ignoring');
      }
      
      // Remove _id if present (cannot change user ID)
      if (updateData._id) {
        delete updateData._id;
      }
      
      // Remove fields that should not be updated
      delete updateData.__v;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.joinedDate;
      
      // Check if update data is empty
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }
      
      // Parse dateOfBirth if provided
      if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      
      // Find and update user
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-__v');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      console.log(`[UPDATE] Profile updated for user: ${user._id}`);
      
      // Convert user to plain object
      const userObject = user.toObject();
      
      // Return updated user
      return res.status(200).json({
        success: true,
        user: userObject
      });
      
    } catch (error) {
      console.error('[UPDATE] Profile update error:', error.message);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message).join(', ');
        return res.status(400).json({
          success: false,
          message: `Validation error: ${messages}`
        });
      }
      
      // Handle invalid ObjectId
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
      
      // Pass to global error handler
      next(error);
    }
  }
);

module.exports = router;
