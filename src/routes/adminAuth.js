/**
 * Admin Authentication Routes
 * Handles admin login
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { generateAdminToken } = require('../utils/jwt');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation rules
const loginValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').trim().notEmpty().withMessage('Password is required')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }
  next();
};

/**
 * POST /api/admin/auth/login
 * Admin Login
 */
router.post(
  '/login',
  loginValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find admin by email
      const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // Check if admin account is active
      if (!admin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'This admin account has been deactivated.'
        });
      }

      // Verify bcrypt password
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // Generate JWT
      const token = generateAdminToken(admin._id.toString(), admin.email, admin.role);

      // Update last login timestamp
      admin.lastLogin = new Date();
      await admin.save();

      console.log(`[ADMIN_AUTH] Successful login for admin: ${admin.name} (${admin.email})`);

      return res.status(200).json({
        success: true,
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });

    } catch (error) {
      console.error('[ADMIN_AUTH] Login error:', error.message);
      next(error);
    }
  }
);

module.exports = router;
