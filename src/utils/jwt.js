/**
 * JWT Token Utilities
 * Handles JWT token generation and verification
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @param {string} phone - User phone number
 * @returns {string} - JWT token
 */
const generateToken = (userId, phone) => {
  const payload = {
    userId,
    phone
  };

//   return jwt.sign(payload, JWT_SECRET, {
//     expiresIn: JWT_EXPIRES_IN
//   });
// };


  
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  
    console.log('[JWT] Generated token for user:', userId); // logs userId only
    console.log('[JWT] Token:', token); // logs the actual token (for testing only)
  
    return token;
  };

/**
 * Generate a short-lived reset token
 * @param {string} userId - User ID
 * @param {string} phone - User phone number
 * @returns {string} - JWT reset token
 */
const generateResetToken = (userId, phone) => {
  const payload = {
    userId,
    phone,
    isResetToken: true
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m' // 15 minutes expiration for reset token
  });

  return token;
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} - Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Generate JWT token for admin
 * @param {string} adminId - Admin ID
 * @param {string} email - Admin email address
 * @param {string} role - Admin role (default: admin)
 * @returns {string} - JWT token
 */
const generateAdminToken = (adminId, email, role = 'admin') => {
  const payload = {
    adminId,
    email,
    role
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  console.log('[JWT] Generated token for admin:', adminId);
  return token;
};

module.exports = {
  generateToken,
  generateResetToken,
  generateAdminToken,
  verifyToken
};
