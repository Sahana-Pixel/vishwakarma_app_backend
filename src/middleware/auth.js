/**
 * JWT Authentication Middleware
 * Protects routes by verifying JWT token
 */

const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to authenticate JWT token
 * Extracts token from Authorization header
 * Verifies token and attaches user info to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      });
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
    }

    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify token
    try {
      const decoded = verifyToken(token);
      
      // Attach user info to request
      req.user = {
        userId: decoded.userId,
        phone: decoded.phone
      };

      next();
    } catch (error) {
      // Token verification failed
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('[AUTH] Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = {
  authenticate
};
