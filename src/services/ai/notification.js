require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const twilio            = require('twilio');
const nodemailer        = require('nodemailer');
const { getPrompt }     = require('./prompt');
const { generateEmailTemplate } = require('./emailTemplate');
const AiProgress = require('../../models/AiProgress.model');

const URI       = process.env.MONGODB_URI;
const DB_NAME   = '24HRClientDev';
const COLL      = 'notifications';

const twClient  = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const mailer    = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASS
  }
});

async function withRetry(fn, retries = 5, delay = 300) {
  try { return await fn(); }
  catch (err) {
    if (retries <= 1) throw err;
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay);
  }
}

/**
 * Service function to handle notifications across multiple channels
 * @param {Object} params Notification parameters
 * @param {string} params.ticketId Ticket ID to associate with notification
 * @param {string} params.functionKey Function key for prompt lookup
 * @param {string} params.status Status of the notification
 * @param {Object} [params.params={}] Additional parameters for prompts
 * @param {string[]} [params.smsTo=[]] List of phone numbers to send SMS to
 * @param {string[]} [params.emailTo=[]] List of email addresses to send email to
 * @param {boolean} [params.shouldThrowError=true] Whether to throw errors or return error status
 * @returns {Promise<Object>} Notification results
 */
async function notifyService({
  ticketId,
  functionKey,
  status,
  params = {},
  smsTo = [],
  emailTo = [],
  shouldThrowError = true
}) {
  if (!ticketId || !functionKey || !status) {
    const error = new Error('ticketId, functionKey and status are required');
    if (shouldThrowError) throw error;
    return {
      success: false,
      error: error.message,
      recipients: []
    };
  }

  let client;
  try {
    client = new MongoClient(URI, { useUnifiedTopology: true, useNewUrlParser: true });
    await withRetry(() => client.connect());
    const db = client.db(DB_NAME);

    const timestamp = new Date();
    const recipients = [];

    // 1) System‐log
    const sysLog = getPrompt(functionKey, 'sys', status, params);
    recipients.push({ channel: 'system logs', target: ticketId, result: sysLog, error: null });

    // 2) SMS channel
    const smsText = getPrompt(functionKey, 'sms', status, params);
    for (let to of smsTo) {
      try {
        const msg = await withRetry(() =>
          twClient.messages.create({
            body: smsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to
          })
        );
        recipients.push({ channel: 'sms', target: to, result: msg.sid, error: null });
      } catch (err) {
        recipients.push({ channel: 'sms', target: to, result: null, error: err.message });
      }
    }

    // 3) Email channel
    for (let to of emailTo) {
      try {
        const { subject, body } = getPrompt(functionKey, 'email', status, params);
        const html = generateEmailTemplate({
          title: subject,
          bodyHtml: `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
          logoUrl: process.env.LOGO_URL,
          companyName: "24HR Truck Services",
          contactInfo: '123 Service Road, Suite 100 • Phoenix, AZ 85001'
        });
        const info = await mailer.sendMail({
          from: `"24HR Notifications" <${process.env.FROM_EMAIL}>`,
          to,
          subject,
          html
        });
        recipients.push({ channel: 'email', target: to, result: info.messageId, error: null });
      } catch (err) {
        recipients.push({ channel: 'email', target: to, result: null, error: err.message });
      }
    }

    // 4) Persist to MongoDB
    const newRun = { timestamp, status, sysLog, recipients };
    const functionName = functionKey;
    const oid = new ObjectId(ticketId);

    try {
      const updateResult = await db.collection(COLL).updateOne(
        { ticketId: oid, "functions.functionName": functionName },
        { $push: { "functions.$.runs": newRun } }
      );
      if (updateResult.matchedCount === 0) {
        await db.collection(COLL).updateOne(
          { ticketId: oid },
          { $push: { functions: { functionName, runs: [newRun] } } },
          { upsert: true }
        );
      }
    } catch (dbError) {
      console.error('❌ MongoDB persistence error:', dbError);
      // Don't fail the whole notification if just persistence fails
      recipients.push({ 
        channel: 'database', 
        target: ticketId, 
        result: null, 
        error: dbError.message 
      });
    }

    return { success: true, recipients };
  } catch (error) {
    console.error('❌ notifyService error:', error);
    if (shouldThrowError) throw error;
    return {
      success: false,
      error: error.message,
      recipients: []
    };
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

/**
 * Express route handler for notifications
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 */
exports.notify = async function (req, res) {
  try {
    const result = await notifyService(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ notify handler error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send notifications' 
    });
  }
};

/**
 * Service function for sending driver SMS
 * @param {Object} params SMS parameters
 * @returns {Promise<Object>} SMS result
 */
async function sendDriverSmsService({
  companyName,
  aiNumber,
  address,
  insuredName,
  shortUrl,
  toNumber
}) {
  if (!insuredName || !shortUrl || !toNumber || !aiNumber) {
    throw new Error('Missing required fields');
  }

  const smsBody = `Hey ${insuredName},\n\n` +
    `This is a message from 24 Hour Truck Services. We are in the process of finding a mechanic to be dispatched to the location of your vehicle.\n\n` +
    `However we need to ascertain your location. Kindly click on the link below, grant location access and we will find mechanics closest to you.\n\n` +
    `${shortUrl}\n\n` +
    `Thanks for your co-operation\n\n` +
    `${companyName || "24Hr Truck Services"} Inc\n` +
    `powered by 24Hr Truck Services ${aiNumber}\n\n` +
    `${address || "300 Delaware Ave. Suite 210"}`;

  try {
    const result = await withRetry(() =>
      twClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      })
    );
    return { success: true, sid: result.sid, to: result.to };
  } catch (error) {
    console.error('❌ sendDriverSms error:', error);
    throw error;
  }
}

/**
 * Express route handler for sending driver SMS
 */
exports.sendDriverSms = async function (req, res) {
  try {
    const result = await sendDriverSmsService(req.body);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error.message || 'SMS send failed' });
  }
};

// Service function for emitting progress
async function emitProgressService({ ticketId, step, status, metadata = {} }) {
  if (!ticketId || !step || !status) {
    throw new Error('ticketId, step and status are required');
  }

  try {
    // Find and update or create new progress document
    const progress = await AiProgress.findOneAndUpdate(
      { ticketId },
      {
        $push: {
          details: {
            step,
            status,
            metadata,
            createdAt: new Date()
          }
        }
      },
      { 
        upsert: true, 
        new: true 
      }
    );

    return { success: true, message: 'Progress event persisted', data: progress };
  } catch (err) {
    console.error('❌ emitProgress error:', err);
    throw err;
  }
}

// Express route handler for emitting progress
exports.emitProgress = async function (req, res) {
  try {
    const result = await emitProgressService(req.body);
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.message || 'Failed to emit progress' });
  }
};

// Export service functions
module.exports = {
  notify: exports.notify,
  notifyService,
  sendDriverSms: exports.sendDriverSms,
  sendDriverSmsService,
  emitProgress: exports.emitProgress,
  emitProgressService
};