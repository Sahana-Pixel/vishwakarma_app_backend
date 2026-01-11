/**
 * Users Routes
 * Handles user-related endpoints
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

/**
 * GET /api/users
 * Get all registered users (members)
 * Protected route - requires JWT authentication
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "users": [
 *     {
 *       "_id": "...",
 *       "name": "John Doe",
 *       "phone": "+919876543210",
 *       "email": "john@example.com",
 *       "occupation": "Self-Employed",
 *       ...
 *     },
 *     ...
 *   ],
 *   "total": 150
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "message": "Error message"
 * }
 */
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      // Fetch all users from database
      // Select only necessary fields for the list view
      const users = await User.find()
        .select('name phone email occupation residenceAddress dateOfBirth')
        .sort({ name: 1 }) // Sort alphabetically by name
        .lean(); // Return plain JavaScript objects

      console.log(`[USERS] Fetched ${users.length} users`);

      // Return users list
      return res.status(200).json({
        success: true,
        users,
        total: users.length
      });

    } catch (error) {
      console.error('[USERS] Get users error:', error.message);

      // Pass to global error handler
      next(error);
    }
  }
);

module.exports = router;
