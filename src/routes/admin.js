/**
 * Admin Action Routes
 * Protected admin operations
 */

const express = require('express');
const XLSX = require('xlsx');
const { authenticateAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Announcement = require('../models/Announcement');

const router = express.Router();

// Apply admin authentication to all routes here
router.use(authenticateAdmin);

/**
 * GET /api/admin/analytics
 * Get dashboard analytics stats
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const totalMembers = await User.countDocuments();
    
    // Recently joined (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentlyJoined = await User.countDocuments({
      joinedDate: { $gte: thirtyDaysAgo }
    });

    // Group by Occupation
    const occupationStats = await User.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$occupation', 'Not Specified'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Group by Gender
    const genderStats = await User.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$gender', 'Not Specified'] },
          count: { $sum: 1 }
        }
      }
    ]);

    // Group by House Type
    const houseTypeStats = await User.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$houseType', 'Not Specified'] },
          count: { $sum: 1 }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalMembers,
        recentlyJoined,
        occupations: occupationStats.map(o => ({ name: o._id, count: o.count })),
        genders: genderStats.map(g => ({ name: g._id, count: g.count })),
        houseTypes: houseTypeStats.map(h => ({ name: h._id, count: h.count }))
      }
    });

  } catch (error) {
    console.error('[ADMIN_STATS] Error:', error.message);
    next(error);
  }
});

/**
 * GET /api/admin/members
 * Search/List all members
 */
router.get('/members', async (req, res, next) => {
  try {
    const { name, phone, occupation, location } = req.query;
    const query = {};

    if (name && name.trim() !== '') {
      query.name = new RegExp(name.trim(), 'i');
    }
    if (phone && phone.trim() !== '') {
      query.phone = new RegExp(phone.trim(), 'i');
    }
    if (occupation && occupation.trim() !== '') {
      query.occupation = new RegExp(occupation.trim(), 'i');
    }
    if (location && location.trim() !== '') {
      query.$or = [
        { residenceAddress: new RegExp(location.trim(), 'i') },
        { familyHouse: new RegExp(location.trim(), 'i') }
      ];
    }

    const members = await User.find(query)
      .select('-__v -password -securityAnswer')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      members,
      total: members.length
    });

  } catch (error) {
    console.error('[ADMIN_MEMBERS_LIST] Error:', error.message);
    next(error);
  }
});

/**
 * PUT /api/admin/members/:id
 * Edit member details
 */
router.put('/members/:id', async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    
    // Prevent updating DB ID and phone number if it conflicts
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    if (updateData.numberOfChildren && typeof updateData.numberOfChildren === 'string') {
      updateData.numberOfChildren = parseInt(updateData.numberOfChildren) || 0;
    }

    const member = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v -password -securityAnswer');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    console.log(`[ADMIN_EDIT] Updated member profile: ${member._id}`);

    return res.status(200).json({
      success: true,
      member
    });

  } catch (error) {
    console.error('[ADMIN_MEMBER_EDIT] Error:', error.message);
    next(error);
  }
});

/**
 * DELETE /api/admin/members/:id
 * Delete member
 */
router.delete('/members/:id', async (req, res, next) => {
  try {
    const member = await User.findByIdAndDelete(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    console.log(`[ADMIN_DELETE] Deleted member: ${member.name} (${member.phone})`);

    return res.status(200).json({
      success: true,
      message: 'Member successfully deleted'
    });

  } catch (error) {
    console.error('[ADMIN_MEMBER_DELETE] Error:', error.message);
    next(error);
  }
});

/**
 * GET /api/admin/announcements
 * Retrieve all announcements (including expired ones) for management
 */
router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdDate: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      announcements
    });
  } catch (error) {
    console.error('[ADMIN_ANNOUNCEMENTS_GET] Error:', error.message);
    next(error);
  }
});

/**
 * POST /api/admin/announcements
 * Create an announcement
 */
router.post('/announcements', async (req, res, next) => {
  try {
    const { title, message, expiryDate } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const announcement = new Announcement({
      title: title.trim(),
      message: message.trim(),
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    await announcement.save();
    console.log(`[ADMIN_ANNOUNCEMENT] Created: ${announcement._id}`);

    return res.status(201).json({
      success: true,
      announcement
    });

  } catch (error) {
    console.error('[ADMIN_ANNOUNCEMENT_CREATE] Error:', error.message);
    next(error);
  }
});

/**
 * PUT /api/admin/announcements/:id
 * Edit announcement
 */
router.put('/announcements/:id', async (req, res, next) => {
  try {
    const { title, message, expiryDate } = req.body;
    
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (message) updateData.message = message.trim();
    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    console.log(`[ADMIN_ANNOUNCEMENT] Updated: ${announcement._id}`);

    return res.status(200).json({
      success: true,
      announcement
    });

  } catch (error) {
    console.error('[ADMIN_ANNOUNCEMENT_EDIT] Error:', error.message);
    next(error);
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * Delete announcement
 */
router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    console.log(`[ADMIN_ANNOUNCEMENT] Deleted: ${announcement._id}`);

    return res.status(200).json({
      success: true,
      message: 'Announcement successfully deleted'
    });

  } catch (error) {
    console.error('[ADMIN_ANNOUNCEMENT_DELETE] Error:', error.message);
    next(error);
  }
});

/**
 * GET /api/admin/export/csv
 * Export member list as CSV
 */
router.get('/export/csv', async (req, res, next) => {
  try {
    const users = await User.find().sort({ name: 1 }).lean();

    const headers = [
      'S.No', 'Name', 'Phone', 'Email', 'Gender', 'Date of Birth', 'Aadhaar',
      'Father Name', 'Mother Name', 'Gothra', 'Relationship', 'Education',
      'Upanayana', 'Marital Status', 'Occupation', 'Occupation Details',
      'Annual Income', 'Tax Payer', 'House Type', 'Address', 'Family House',
      'Ration Card', 'Special Person', 'Joined Date'
    ].join(',');

    const rows = users.map((u, i) => [
      i + 1,
      `"${u.name || ''}"`,
      `"${u.phone || ''}"`,
      `"${u.email || ''}"`,
      `"${u.gender || ''}"`,
      `"${u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : ''}"`,
      `"${u.aadhaar || ''}"`,
      `"${u.fatherName || ''}"`,
      `"${u.motherName || ''}"`,
      `"${u.gothra || ''}"`,
      `"${u.relationshipWithHead || ''}"`,
      `"${u.education || ''}"`,
      `"${u.upanayana ? 'Yes' : 'No'}"`,
      `"${u.maritalStatus || ''}"`,
      `"${u.occupation || ''}"`,
      `"${u.occupationDetails || ''}"`,
      `"${u.annualIncome || ''}"`,
      `"${u.taxPayer ? 'Yes' : 'No'}"`,
      `"${u.houseType || ''}"`,
      `"${u.residenceAddress || ''}"`,
      `"${u.familyHouse || ''}"`,
      `"${u.rationCardType || ''}"`,
      `"${u.specialPerson ? 'Yes' : 'No'}"`,
      `"${u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : ''}"`
    ].join(','));

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // Add UTF-8 BOM for Excel compatibility

    res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('[ADMIN_EXPORT_CSV] Error:', error.message);
    next(error);
  }
});

/**
 * GET /api/admin/export/excel
 * Export member list as Excel spreadsheet
 */
router.get('/export/excel', async (req, res, next) => {
  try {
    const users = await User.find().sort({ name: 1 }).lean();

    const exportData = users.map((u, i) => ({
      'S.No': i + 1,
      'Name': u.name || '',
      'Phone': u.phone || '',
      'Email': u.email || '',
      'Gender': u.gender || '',
      'Date of Birth': u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : '',
      'Aadhaar': u.aadhaar || '',
      'Father Name': u.fatherName || '',
      'Mother Name': u.motherName || '',
      'Gothra': u.gothra || '',
      'Relationship': u.relationshipWithHead || '',
      'Education': u.education || '',
      'Upanayana': u.upanayana ? 'Yes' : 'No',
      'Marital Status': u.maritalStatus || '',
      'Occupation': u.occupation || '',
      'Occupation Details': u.occupationDetails || '',
      'Annual Income': u.annualIncome || '',
      'Tax Payer': u.taxPayer ? 'Yes' : 'No',
      'House Type': u.houseType || '',
      'Address': u.residenceAddress || '',
      'Family House': u.familyHouse || '',
      'Ration Card': u.rationCardType || '',
      'Special Person': u.specialPerson ? 'Yes' : 'No',
      'Joined Date': u.joinedDate ? new Date(u.joinedDate).toLocaleDateString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Members");

    // Adjust column widths
    ws['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 20 },  // Name
      { wch: 15 },  // Phone
      { wch: 25 },  // Email
      { wch: 8 },   // Gender
      { wch: 12 },  // DOB
      { wch: 15 },  // Aadhaar
      { wch: 20 },  // Father Name
      { wch: 20 },  // Mother Name
      { wch: 12 },  // Gothra
      { wch: 15 },  // Relationship
      { wch: 15 },  // Education
      { wch: 10 },  // Upanayana
      { wch: 15 },  // Marital Status
      { wch: 20 },  // Occupation
      { wch: 25 },  // Occupation Details
      { wch: 15 },  // Annual Income
      { wch: 10 },  // Tax Payer
      { wch: 15 },  // House Type
      { wch: 35 },  // Address
      { wch: 12 },  // Family House
      { wch: 12 },  // Ration Card
      { wch: 12 },  // Special Person
      { wch: 12 }   // Joined Date
    ];

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="members.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);

  } catch (error) {
    console.error('[ADMIN_EXPORT_EXCEL] Error:', error.message);
    next(error);
  }
});

module.exports = router;
