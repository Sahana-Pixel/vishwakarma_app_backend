/**
 * In-Memory Rate Limiter Middleware
 * Prevents abuse of OTP endpoints
 */

// Store: { phoneNumber: { count: number, resetTime: timestamp } }
const rateLimitStore = new Map();

// Configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 3,           // Maximum OTP requests per window
  windowMs: 60 * 1000,      // 1 minute window
  blockDurationMs: 5 * 60 * 1000  // 5 minute block after exceeding limit
};

/**
 * Clean expired entries periodically
 */
const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Rate limiter middleware for OTP requests
 */
const otpRateLimiter = (req, res, next) => {
  const phone = req.body.phone;
  
  if (!phone) {
    return next(); // Let validation handle missing phone
  }

  const now = Date.now();
  const key = phone.replace(/\D/g, ''); // Normalize phone number
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
      blocked: false
    };
    rateLimitStore.set(key, entry);
    return next();
  }

  // Check if blocked
  if (entry.blocked) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many requests. Please try again in ${remainingTime} seconds.`
    });
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > RATE_LIMIT_CONFIG.maxAttempts) {
    entry.blocked = true;
    entry.resetTime = now + RATE_LIMIT_CONFIG.blockDurationMs;
    rateLimitStore.set(key, entry);

    return res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please try again in 5 minutes.'
    });
  }

  rateLimitStore.set(key, entry);
  next();
};

/**
 * Get remaining attempts for a phone number
 */
const getRemainingAttempts = (phone) => {
  const key = phone.replace(/\D/g, '');
  const entry = rateLimitStore.get(key);
  
  if (!entry || Date.now() > entry.resetTime) {
    return RATE_LIMIT_CONFIG.maxAttempts;
  }

  return Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - entry.count);
};

module.exports = {
  otpRateLimiter,
  getRemainingAttempts
};
