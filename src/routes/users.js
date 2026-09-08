/**
 * Users Routes
 * Handles user-related endpoints
 */

const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

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
        .select('name phone email occupation residenceAddress dateOfBirth professionDescription workImages contributionOptions contributionDescription contributionSubmittedAt')
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

      // Exclude current user, ensure they have a location, and location is visible
      const query = {
        _id: { $ne: new mongoose.Types.ObjectId(req.user.userId) },
        location: { $ne: null },
        isLocationVisible: { $ne: false }
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
            distance: 1,
            professionDescription: 1,
            workImages: 1,
            contributionOptions: 1,
            contributionDescription: 1,
            contributionSubmittedAt: 1
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

/**
 * POST /api/users/work-images
 * Upload a work image to member's gallery
 */
router.post(
  '/work-images',
  authenticate,
  (req, res, next) => {
    console.log('[DEBUG_UPLOAD] Incoming multipart headers:', req.headers);
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error('[DEBUG_UPLOAD] Multer parsing failed:', err.message);
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        console.log('[DEBUG_UPLOAD] User not found in database:', req.user.userId);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.workImages && user.workImages.length >= 10) {
        console.log('[DEBUG_UPLOAD] User already has 10 work images');
        return res.status(400).json({
          success: false,
          message: 'Maximum limit of 10 work images reached'
        });
      }

      if (!req.file) {
        console.log('[DEBUG_UPLOAD] No req.file parsed in request body');
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }

      console.log('[DEBUG_UPLOAD] File properties parsed successfully:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Upload file buffer to Cloudinary
      const uploadResult = await uploadImage(req.file.buffer);
      console.log('[DEBUG_UPLOAD] Cloudinary upload success:', uploadResult);

      const existingCount = user.workImages ? user.workImages.length : 0;
      const isPrimary = existingCount === 0;

      const newWorkImage = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        uploadedAt: new Date(),
        order: existingCount,
        isPrimary: isPrimary
      };

      if (!user.workImages) {
        user.workImages = [];
      }

      user.workImages.push(newWorkImage);
      await user.save();
      
      console.log('[DEBUG_UPLOAD] Saved new work image to MongoDB. Current gallery:', user.workImages);

      return res.status(200).json({
        success: true,
        workImages: user.workImages
      });
    } catch (error) {
      console.error('[DEBUG_UPLOAD] Unexpected route exception:', error.message);
      next(error);
    }
  }
);

/**
 * DELETE /api/users/work-images/:publicId(*)
 * Delete work image from Cloudinary and profile
 */
router.delete(
  '/work-images/:publicId(*)',
  authenticate,
  async (req, res, next) => {
    try {
      const { publicId } = req.params;
      console.log(`[DEBUG_DELETE] Deleting image ${publicId} for user ${req.user.userId}`);

      const user = await User.findById(req.user.userId);
      if (!user) {
        console.log('[DEBUG_DELETE] User not found in database:', req.user.userId);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const imageIndex = user.workImages.findIndex(img => img.publicId === publicId);
      if (imageIndex === -1) {
        console.log('[DEBUG_DELETE] Image not found in profile:', publicId);
        return res.status(404).json({ success: false, message: 'Image not found in profile' });
      }

      // Delete from Cloudinary first
      await deleteImage(publicId);
      console.log('[DEBUG_DELETE] Deleted image from Cloudinary:', publicId);

      const deletedImage = user.workImages[imageIndex];
      const wasPrimary = deletedImage.isPrimary;

      // Remove from MongoDB array
      user.workImages.splice(imageIndex, 1);

      // Re-index remaining images orders & re-assign primary status if needed
      user.workImages.forEach((img, idx) => {
        img.order = idx;
      });

      if (wasPrimary && user.workImages.length > 0) {
        user.workImages[0].isPrimary = true;
      }

      await user.save();
      console.log('[DEBUG_DELETE] MongoDB update success. Remaining gallery:', user.workImages);

      return res.status(200).json({
        success: true,
        workImages: user.workImages
      });
    } catch (error) {
      console.error('[DEBUG_DELETE] Error deleting work image:', error.message);
      next(error);
    }
  }
);

/**
 * PUT /api/users/profession
 * Update profession description
 */
router.put(
  '/profession',
  authenticate,
  async (req, res, next) => {
    try {
      const { professionDescription } = req.body;

      if (professionDescription && professionDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Profession description cannot exceed 1000 characters'
        });
      }

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        { $set: { professionDescription: professionDescription || null } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        professionDescription: user.professionDescription
      });
    } catch (error) {
      console.error('[PROFESSION] Error updating description:', error.message);
      next(error);
    }
  }
);

/**
 * PUT /api/users/contribution
 * Update user community contribution interests and description
 */
router.put(
  '/contribution',
  authenticate,
  async (req, res, next) => {
    try {
      const { contributionOptions, contributionDescription } = req.body;

      if (contributionDescription && contributionDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Contribution description cannot exceed 1000 characters'
        });
      }

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        {
          $set: {
            contributionOptions: contributionOptions || [],
            contributionDescription: contributionDescription || null,
            contributionSubmittedAt: new Date()
          }
        },
        { new: true }
      ).select('-__v -password -securityAnswer');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log(`[CONTRIBUTION] Updated contribution details for user ${user._id}`);

      return res.status(200).json({
        success: true,
        user
      });
    } catch (error) {
      console.error('[CONTRIBUTION] Error updating contribution:', error.message);
      next(error);
    }
  }
);

module.exports = router;
