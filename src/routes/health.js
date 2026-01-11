/**
 * Health Check Routes
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * GET /health
 * Returns server and database health status
 */
router.get('/', async (req, res, next) => {
  try {
    // Check MongoDB connection state
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const healthCheck = {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      server: {
        status: 'healthy',
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        status: dbStatus[dbState] || 'unknown',
        connected: dbState === 1
      }
    };

    // If DB is not connected, indicate partial health
    if (dbState !== 1) {
      healthCheck.server.status = 'degraded';
    }

    res.status(200).json(healthCheck);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
