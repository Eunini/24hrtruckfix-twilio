const twilioService = require("../services/message.services");

/**
 * GET /api/twilio/numbers
 */
async function listNumbers(req, res) {
  try {
    const numbers = await twilioService.listTwilioNumbers();
    return res.status(200).json({ success: true, count: numbers.length, numbers });
  } catch (err) {
    console.error("listNumbers err:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/twilio/messages?number=%2B123...
 * Returns grouped chats (and persists messages into Mongo as part of service)
 */
async function getMessagesGrouped(req, res) {
  try {
    const twilioNumber = req.query.number || req.params.number;
    if (!twilioNumber) return res.status(400).json({ success: false, error: "number query param required (URL-encode +)" });

    const data = await twilioService.getMessagesByNumber(twilioNumber);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error("getMessagesGrouped err:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function sendMessages(req, res) {
  try {
    const { from, to, body } = req.body || {};
    if (!from || !to || !body) {
      return res.status(400).json({ success: false, message: 'from, to and body are required' });
    }

    const result = await twilioService.sendMessage(from, to, body);

    return res.status(201).json({ success: true, message: result });
  } catch (err) {
    console.error('sendMessageController error', err);
    return res.status(500).json({ success: false, message: err.message || 'Error sending message' });
  }
}

/**
 * POST /api/twilio/webhook/messages
 * Twilio will POST application/x-www-form-urlencoded fields (From, To, Body, MessageSid, etc)
 * We save the incoming message into Mongo and return a simple JSON response.
 *
 * NOTE: If you want Twilio to process your response as TwiML, respond with XML.
 */
async function twilioIncomingWebhook(req, res) {
    console.log("webhook for all numbers", req.body)
  try {
    const payload = req.body || {};
    console.log("Twilio webhook payload:", payload);

    const saved = await twilioService.handleIncomingMessage(payload);

    // Respond 200 OK. (You can return TwiML text/xml if you want Twilio to send a reply)
    return res.status(200).json({ success: true, saved });
  } catch (err) {
    console.error("twilioIncomingWebhook err:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/twilio/calls?number=%2B123...
 */
async function getCalls(req, res) {
  try {
    const twilioNumber = req.query.number;
    if (!twilioNumber) return res.status(400).json({ success: false, error: "number query param required (URL-encode +)" });

    const calls = await twilioService.getCallsByNumber(twilioNumber);
    return res.status(200).json({ success: true, count: calls.length, calls });
  } catch (err) {
    console.error("getCalls err:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function incomingCallWebhook (req, res) {
  try {
    await twilioService.handleIncomingCall(req.body);
    res.status(200).send("Call stored");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/v1/twilio/token?identity=...  (identity optional)
 * Returns { success:true, token, identity }
 */
function tokenController(req, res) {
  try {
    const identity = req.query.identity || `user-${Date.now()}`;
    const token = twilioService.generateAccessToken(identity);
    return res.json({ success: true, token, identity });
  } catch (err) {
    console.error("tokenController error:", err && err.message);
    const code = err && err.code;
    if (code === "MISSING_API_KEY" || code === "MISSING_TWIML_APP") {
      return res.status(500).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Failed to generate token" });
  }
}

async function voiceWebhookController(req, res) {
  try {
    // Twilio posts form-encoded parameters
    const rawTo = req.body.To || req.body.to || req.query.To || req.query.to;
    const rawCaller = req.body.callerId || req.body.caller || req.query.callerId || req.query.caller;

    if (!rawTo) {
      const errTwiml = `<Response><Say>Invalid destination number provided.</Say></Response>`;
      return res.type("text/xml").status(400).send(errTwiml);
    }

    // If a callerId was provided client-side, normalize & validate ownership
    let callerId = null;
    if (rawCaller) {
      if (!rawCaller) {
        const errTwiml = `<Response><Say>Invalid caller id provided.</Say></Response>`;
        return res.type("text/xml").status(400).send(errTwiml);
      }
      callerId = rawCaller;
    }

    // Build TwiML with validated callerId (or undefined if none)
    const twiml = twilioService.buildDialTwiML(rawTo, callerId);
    return res.type("text/xml").status(200).send(twiml);
  } catch (err) {
    console.error("voiceWebhookController error:", err && err.message);
    const twiml = `<Response><Say>Server error occurred. Please try again later.</Say></Response>`;
    return res.type("text/xml").status(500).send(twiml);
  }
}


// async function initCache  (req, res) {
//   try {
//     await twilioService.initTwilioCache(req.body);
//     res.status(200).json({ message: "Twilio cache initialized successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

module.exports = {
  getCalls,
  listNumbers,
  sendMessages,
  tokenController,
  getMessagesGrouped,
  incomingCallWebhook,
  twilioIncomingWebhook,
  voiceWebhookController,
};
