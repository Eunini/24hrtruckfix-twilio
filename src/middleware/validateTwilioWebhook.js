const twilio = require('twilio');
const url = require('url');

/**
 * Middleware to validate Twilio webhook requests
 * Uses Twilio's validateRequest method to verify the request signature
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateTwilioWebhook = (req, res, next) => {
  // Get Twilio auth token from environment variables
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN is not set in environment variables');
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error' 
    });
  }

  // Get the full URL from the request
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;
  
  // Get Twilio signature from headers
  const twilioSignature = req.headers['x-twilio-signature'];

  if (!twilioSignature) {
    console.error('Missing X-Twilio-Signature header');
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid request: missing signature' 
    });
  }

  // Parse request URL
  const parsedUrl = url.parse(fullUrl, true);
  
  // Get request body (Twilio sends as application/x-www-form-urlencoded)
  const requestBody = req.body || {};
  
  // Validate the request using Twilio's helper
  const isValid = twilio.validateRequest(
    authToken,
    twilioSignature,
    parsedUrl.href,
    requestBody
  );

  if (isValid) {
    // Request is valid - proceed
    console.log('✅ Twilio webhook signature validated successfully');
    next();
  } else {
    // Invalid request - reject
    console.error('❌ Invalid Twilio webhook signature');
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid request signature' 
    });
  }
};

module.exports = validateTwilioWebhook;