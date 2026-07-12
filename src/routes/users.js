/**
 * Users Routes
 * Handles user-related endpoints
 */

const express = require('express');
const mongoose = require('mongoose');
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

/**
 * GET /api/users/nearby
 * Find nearby members
 * Protected route - requires JWT authentication
 */
router.get(
  '/nearby',
  authenticate,
  async (req, res, next) => {
    try {
      const { latitude, longitude, radius, occupation } = req.query;

      if (!latitude || !longitude || !radius) {
        return res.status(400).json({
          success: false,
          message: 'latitude, longitude, and radius query parameters are required'
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radKm = parseFloat(radius);

      if (isNaN(lat) || isNaN(lng) || isNaN(radKm)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude, longitude, or radius values'
        });
      }

      // Convert radius to meters
      const radiusInMeters = radKm * 1000;

      // Exclude current user and ensure they have a location
      const query = {
        _id: { $ne: new mongoose.Types.ObjectId(req.user.userId) },
        location: { $ne: null }
      };

      if (occupation && occupation.trim() !== '') {
        query.occupation = occupation.trim();
      }

      const nearbyUsers = await User.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            distanceField: 'distance', // distance in meters
            maxDistance: radiusInMeters,
            spherical: true,
            query: query
          }
        },
        {
          $project: {
            name: 1,
            occupation: 1,
            profileImage: 1,
            location: 1,
            distance: 1
          }
        }
      ]);

      console.log(`[NEARBY] Found ${nearbyUsers.length} nearby members for user ${req.user.userId}`);

      return res.status(200).json({
        success: true,
        members: nearbyUsers,
        total: nearbyUsers.length
      });

    } catch (error) {
      console.error('[NEARBY] Error finding nearby members:', error.message);
      next(error);
    }
  }
);

module.exports = router;
