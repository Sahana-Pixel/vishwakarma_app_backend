/**
 * Member Announcement Routes
 * Handles retrieval of active announcements
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const Announcement = require('../models/Announcement');

const router = express.Router();

/**
 * GET /api/announcements
 * Retrieve active announcements (sorted by newest first)
 * Excludes expired announcements
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const now = new Date();

    // Find announcements that have not expired
    const activeAnnouncements = await Announcement.find({
      $or: [
        { expiryDate: null },
        { expiryDate: { $exists: false } },
        { expiryDate: { $gte: now } }
      ]
    })
    .sort({ createdDate: -1 })
    .lean();

    // Format fields for frontend compatibility
    const formattedAnnouncements = activeAnnouncements.map(doc => {
      const createdTime = doc.createdDate || doc.createdAt;
      
      // Format: "Sep 17, 2024"
      const formattedDate = createdTime
        ? new Date(createdTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        : '';

      // Mark as NEW if created in the last 48 hours
      const isNew = (Date.now() - new Date(createdTime).getTime()) < 48 * 60 * 60 * 1000;

      return {
        _id: doc._id,
        title: doc.title,
        description: doc.message, // Map 'message' from DB to 'description' for widget compatibility
        date: formattedDate,
        isNew,
        expiryDate: doc.expiryDate
      };
    });

    console.log(`[ANNOUNCEMENTS] Fetched ${formattedAnnouncements.length} active announcements`);

    return res.status(200).json({
      success: true,
      announcements: formattedAnnouncements,
      total: formattedAnnouncements.length
    });

  } catch (error) {
    console.error('[ANNOUNCEMENTS] Get announcements error:', error.message);
    next(error);
  }
});

module.exports = router;
