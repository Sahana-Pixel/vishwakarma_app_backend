/**
 * Twilio Verify Service
 * Handles OTP sending via Twilio Verify API
 */

const twilio = require('twilio');

// Twilio client instance (lazy initialization)
let twilioClient = null;

/**
 * Get or create Twilio client
 */
const getClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

/**
 * Send OTP to phone number using Twilio Verify
 * @param {string} phoneNumber - Phone number with country code (e.g., +919876543210)
 * @returns {Promise<object>} - Twilio verification response
 */
const sendOTP = async (phoneNumber) => {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  
  if (!serviceSid) {
    throw new Error('Twilio Verify Service SID not configured');
  }

  // Check SMS_MODE for testing/production
  const smsMode = process.env.SMS_MODE || 'live';
  
  // In test mode, simulate success without calling Twilio
  if (smsMode === 'test') {
    console.log(`[TEST MODE] OTP would be sent to ${phoneNumber}`);
    return {
      status: 'pending',
      to: phoneNumber,
      channel: 'sms',
      valid: true
    };
  }

  // Send OTP via Twilio Verify
  const client = getClient();
  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({
      to: phoneNumber,
      channel: 'sms'
    });

  return {
    status: verification.status,
    to: verification.to,
    channel: verification.channel,
    valid: verification.valid
  };
};

/**
 * Verify OTP using Twilio Verify API
 * @param {string} phoneNumber - Phone number with country code (e.g., +919876543210)
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<object>} - Twilio verification check response
 */
const verifyOTP = async (phoneNumber, otp) => {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  
  if (!serviceSid) {
    throw new Error('Twilio Verify Service SID not configured');
  }

  // Check SMS_MODE for testing/production
  const smsMode = process.env.SMS_MODE || 'live';
  
  // In test mode, accept any 6-digit OTP
  if (smsMode === 'test') {
    if (otp.length === 6 && /^\d{6}$/.test(otp)) {
      console.log(`[TEST MODE] OTP verified for ${phoneNumber}`);
      return {
        status: 'approved',
        valid: true
      };
    } else {
      return {
        status: 'pending',
        valid: false
      };
    }
  }

  // Verify OTP via Twilio Verify
  const client = getClient();
  const verificationCheck = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({
      to: phoneNumber,
      code: otp
    });

  return {
    status: verificationCheck.status,
    valid: verificationCheck.status === 'approved'
  };
};

/**
 * Parse Twilio error for user-friendly message
 * @param {Error} error - Twilio error object
 * @returns {string} - User-friendly error message
 */
const parseTwilioError = (error) => {
  // Common Twilio error codes
  const errorMessages = {
    20003: 'Authentication failed. Check Twilio credentials.',
    20404: 'Twilio Verify service not found.',
    21211: 'Invalid phone number format.',
    21408: 'Phone number not verified for trial account.',
    21610: 'SMS sending blocked for this number.',
    21614: 'Invalid mobile number.',
    60200: 'Invalid parameter.',
    60203: 'Max send attempts reached. Try again later.',
    60212: 'Too many requests. Please wait before retrying.',
    20429: 'Invalid verification code.',
    60202: 'Too many attempts. Please request a new code.'
  };

  const code = error.code || error.status;
  return errorMessages[code] || error.message || 'Failed to verify OTP';
};

module.exports = {
  sendOTP,
  verifyOTP,
  parseTwilioError
};
