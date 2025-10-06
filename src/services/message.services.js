const twilio = require("twilio");
const PhoneNumber = require("../models/number.model");
const Message = require("../models/message.model");
const Call = require("../models/call.model");
const ApiKeyManager = require("../../utils/ApiKeyManager");

const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const API_SID = process.env.TWILIO_API_KEY_SID;
const API_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWIML_SID = process.env.TWILIO_TWIML_APP_SID;

// Initialize API key manager for Twilio
const twilioKeyManager = new ApiKeyManager({ 
  service: 'twilio', 
  useRotation: process.env.ENABLE_API_KEY_ROTATION === 'true'
});

// Get current Twilio credentials
const getTwilioClient = () => {
  const credentials = twilioKeyManager.getCurrentKey();
  
  if (!credentials || !credentials.sid || !credentials.token) {
    console.error("Twilio credentials not available");
    throw new Error("Twilio credentials not configured correctly");
  }
  
  return twilio(credentials.sid, credentials.token);
};

// Get a client instance
let client = getTwilioClient();

// Function to refresh client if needed (e.g., after key rotation)
const refreshTwilioClient = () => {
  client = getTwilioClient();
  return client;
};

function normalizeNumber(n) {
  if (!n) return n;
  // keep leading + if present, remove any non-digit except leading +
  return (n || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()\-\.]/g, '')
    .replace(/[^+\d]/g, '');
}

// ---------- INIT FETCH FROM TWILIO ONCE ----------
// async function  initTwilioCache() {
//   // Cache phone numbers
//   const phoneCount = await PhoneNumber.countDocuments();
//   if (phoneCount === 0) {
//     const numbers = await client.incomingPhoneNumbers.list();
//     const formatted = numbers.map((n) => ({
//       sid: n.sid,
//       phoneNumber: n.phoneNumber,
//       friendlyName: n.friendlyName,
//       capabilities: n.capabilities,
//     }));
//     await PhoneNumber.insertMany(formatted);
//   }

//   // Cache messages (last 60 days, limit 100 per number)
//   const msgCount = await Message.countDocuments();
//   if (msgCount === 0) {
//     const since = new Date();
//     since.setDate(since.getDate() - 60);

//     const messages = await client.messages.list({ dateSentAfter: since, limit: 100 });
//     const formatted = messages.map((m) => ({
//       sid: m.sid,
//       from: m.from,
//       to: m.to,
//       body: m.body,
//       direction: m.direction,
//       dateSent: m.dateSent,
//       dateCreated: m.dateCreated,
//       status: m.status,
      
//     }));
//     await Message.insertMany(formatted);
//   }

//   // Cache calls (last 60 days, limit 100 per number)
//   const callCount = await Call.countDocuments();
//   if (callCount === 0) {
//     const since = new Date();
//     since.setDate(since.getDate() - 60);

//     const calls = await client.calls.list({ startTimeAfter: since, limit: 100 });
//     const formatted = calls.map((c) => ({
//       sid: c.sid,
//       from: c.from,
//       to: c.to,
//       status: c.status,
//       duration: c.duration,
//       startTime: c.startTime,
//       endTime: c.endTime,
//       price: c.price,
//     }));
//     await Call.insertMany(formatted);
//   }
// }

// ---------- READ FROM DB ONLY ----------
async function listTwilioNumbers() {
  // small helper to retry an async function with exponential backoff
  const retry = async (fn, attempts = 3, initialDelayMs = 500) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        // Check for auth errors that might indicate we need to rotate keys
        if (err.code === 20003 || // Authentication Error
            err.code === 20004 || // Authorization Error
            err.code === 20008) { // Account Not Active
          console.warn(`Twilio authentication error detected, attempting to use secondary key...`);
          try {
            // Try switching to secondary key
            twilioKeyManager.useSecondaryKey();
            refreshTwilioClient();
            // Try again with new credentials
            return await fn();
          } catch (secondaryErr) {
            console.error(`Secondary key also failed:`, secondaryErr.message);
            throw secondaryErr;
          }
        }
        
        if (attempt === attempts) {
          console.error(`All ${attempts} attempts failed.`);
          throw err;
        }
        const delay = initialDelayMs * Math.pow(2, attempt - 1); // 500, 1000, 2000 ms
        console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`, err && err.message);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  };

  try {
    // Only retry the Twilio network/API call — don't retry DB writes
    const numbers = await retry(() => client.incomingPhoneNumbers.list(), 3, 500);

    if (!numbers || numbers.length === 0) {
      console.log("No Twilio numbers returned.");
      return { inserted: 0, skipped: 0 };
    }

    const formatted = numbers.map((n) => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      capabilities: n.capabilities,
      cachedAt: new Date(),
    }));

    const twilioPhoneNumbers = formatted.map((f) => f.phoneNumber);
    const existing = await PhoneNumber.find(
      { phoneNumber: { $in: twilioPhoneNumbers } },
      { phoneNumber: 1, _id: 0 }
    ).lean();

    const existingSet = new Set(existing.map((e) => e.phoneNumber));
    const toInsert = formatted.filter((f) => !existingSet.has(f.phoneNumber));
    let insertedCount = 0;

    if (toInsert.length > 0) {
      try {
        // ordered: false lets Mongo continue on duplicate errors
        await PhoneNumber.insertMany(toInsert, { ordered: false });
        insertedCount = toInsert.length;
      } catch (insertErr) {
        // If some docs failed (e.g. duplicate key), try to estimate how many inserted.
        // BulkWriteError from Mongo usually includes writeErrors array.
        if (insertErr && insertErr.writeErrors && Array.isArray(insertErr.writeErrors)) {
          const failedCount = insertErr.writeErrors.length;
          insertedCount = Math.max(0, toInsert.length - failedCount);
          console.warn(
            `insertMany completed with ${failedCount} write errors; estimated inserted ${insertedCount}.`,
            insertErr.message
          );
        } else {
          // rethrow anything unexpected
          throw insertErr;
        }
      }
    }

    const skippedCount = formatted.length - insertedCount;
    console.log(
      `Twilio refresh complete. Inserted: ${insertedCount}, Skipped (duplicates): ${skippedCount}`
    );

    return await PhoneNumber.find().sort({ cachedAt: -1 });
  } catch (err) {
    console.error("Error refreshing Twilio numbers:", err);
    throw err;
  }
}

async function getMessagesByNumber(twilioNumber, { limit = 1000, days = 60 } = {}) {
  if (!twilioNumber) throw new Error('twilioNumber is required');

  const normalizedQuery = normalizeNumber(twilioNumber);
  const MS_IN_DAY = 24 * 60 * 60 * 1000;
  const threshold = new Date(Date.now() - days * MS_IN_DAY);

  // read a pool from DB filtered by date to keep results small
  const raw = await Message.find({
    $or: [
      { dateSent: { $gte: threshold } },
      { dateSent: null }
    ],
    $or: [{ to: { $exists: true } }, { from: { $exists: true } }]
  })
    .sort({ dateSent: -1, createdAt: -1 })
    .limit(limit * 4) // fetch more and filter locallyx
    .lean();

  const filtered = [];
  for (const m of raw) {
    const fromNorm = normalizeNumber(m.from);
    const toNorm = normalizeNumber(m.to);
    if (fromNorm === normalizedQuery || toNorm === normalizedQuery) {
      const dateSent = m.dateSent ? new Date(m.dateSent) : (m.dateCreated ? new Date(m.dateCreated) : null);
      const msg = {
        _id: m._id,
        sid: m.sid || null,
        from: m.from || null,
        to: m.to || null,
        body: m.body || '',
        direction: m.direction || null,
        status: m.status || null,
        dateSent: dateSent ? dateSent.toISOString() : null,
      };

      // sender flag: if the twilioNumber is the 'from' it's "me", otherwise "them"
      msg.sender = (fromNorm === normalizedQuery) ? 'me' : 'them';

      filtered.push(msg);
    }
    if (filtered.length >= limit) break;
  }

  // group by other participant
  const chats = {};
  for (const msg of filtered) {
    const other = normalizeNumber(msg.from) === normalizedQuery ? normalizeNumber(msg.to) : normalizeNumber(msg.from);
    if (!other) continue;
    chats[other] = chats[other] || [];
    chats[other].push(msg);
  }

  // sort each chat newest -> oldest
  Object.keys(chats).forEach(k => {
    chats[k].sort((a, b) => {
      const da = a.dateSent ? new Date(a.dateSent).getTime() : 0;
      const db = b.dateSent ? new Date(b.dateSent).getTime() : 0;
      return db - da;
    });
  });

  // Sort chat keys by most recent message
  const orderedChats = {};
  Object.entries(chats)
    .sort(([, aMsgs], [, bMsgs]) => {
      const aT = aMsgs[0]?.dateSent ? new Date(aMsgs[0].dateSent).getTime() : 0;
      const bT = bMsgs[0]?.dateSent ? new Date(bMsgs[0].dateSent).getTime() : 0;
      return bT - aT;
    })
    .forEach(([participant, msgs]) => {
      orderedChats[participant] = msgs;
    });

  return {
    success: true,
    me: normalizedQuery,
    count: filtered.length,
    messages: filtered, // flat newest -> oldest
    chats: orderedChats,
  };
}           

async function sendMessage(from, to, body) {
  if (!from || !to || !body) {
    throw new Error("from, to and body are required");
  }

  // Send message through Twilio
  const twilioResp = await client.messages.create({
    from,
    to,
    body,
  });

  // Normalize the data to fit your schema
  const doc = {
    sid: twilioResp.sid,
    from: normalizeNumber(twilioResp.from || from),
    to: normalizeNumber(twilioResp.to || to),
    body: twilioResp.body || body,
    dateSent: twilioResp.dateSent ? new Date(twilioResp.dateSent) : null,
    dateCreated: twilioResp.dateCreated ? new Date(twilioResp.dateCreated) : new Date(),
    direction: "outbound-api",
    status: twilioResp.status || "queued",
  };

  if (from === TWILIO_NUMBER ) {
    try{
      const guessedRole = await messageService.determineRoleByPhone(to);
      const convo = await messageService.findOrCreateConversation({ agentPhone: from, to, agentRole: "agent", otherRole: guessedRole});

      const msg = { from, to, body, status: "pending", createdAt: new Date() };
      convo.messages.push(msg);
      convo.lastUpdatedAt = new Date();
      const data = await convo.save();

      if(data) {
        console.log("Saved to Conversation Collection")
      }
    } catch {
      console.error("Failed to save incoming message to Conversation collection:", msgError);
    }
  }

  // Use findOneAndUpdate to upsert + return the updated doc in a single call
  const saved = await Message.findOneAndUpdate(
    { sid: twilioResp.sid },
    { $set: doc },
    { upsert: true, new: true, lean: true }
  );

  // Prepare for frontend chat UI
  return {
    _id: saved._id,
    sid: saved.sid,
    from: saved.from,
    to: saved.to,
    body: saved.body,
    direction: saved.direction,
    status: saved.status,
    dateSent: saved.dateSent ? saved.dateSent.toISOString() : null,
    sender: "me",
  };
}

async function getCallsByNumber(twilioNumber) {
  
  return await Call.find({
    $or: [{ to: twilioNumber }, { from: twilioNumber }],
  })
    .sort({ startTime: -1 })
    .limit(100);
}

// ---------- WEBHOOK HANDLERS (ONLY UPDATE DB) ----------
async function handleIncomingMessage(data) {
  const msg = new Message({
    sid: data.MessageSid,
    from: data.From,
    to: data.To,
    body: data.Body,
    direction: "inbound",
    dateSent: new Date(),
  });
  await msg.save();
}

async function handleIncomingCall(data) {
  const call = new Call({
    sid: data.CallSid,
    from: data.From,
    to: data.To,
    status: data.CallStatus,
    startTime: new Date(),
  });
  await call.save();
}

/**
 * Generate Access Token for browser voice client.
 * identity optional. Token TTL default 1 hour.
 */
function generateAccessToken(identity = `user-${Date.now()}`, ttl = 3600) {
  if (!API_SID || !API_SECRET) {
    const e = new Error("Missing TWILIO_API_KEY_SID / TWILIO_API_SECRET");
    e.code = "MISSING_API_KEY";
    throw e;
  }
  if (!TWIML_SID) {
    const e = new Error("Missing TWILIO_TWIML_APP_SID");
    e.code = "MISSING_TWIML_APP";
    throw e;
  }

  const token = new AccessToken(ACCOUNT_SID, API_SID, API_SECRET, { ttl });
  token.identity = identity;
  const grant = new VoiceGrant({
    outgoingApplicationSid: TWIML_SID,
    incomingAllow: false,
  });
  token.addGrant(grant);
  return token.toJwt();
}

/**
 * Build TwiML to dial `toNumber` with provided callerId.
 * If callerId is invalid (not owned), we return null — caller should handle sending an error TwiML
 */
function buildDialTwiML(toNumber, callerId) {
  const twiml = new twilio.twiml.VoiceResponse();
  if (!toNumber) {
    twiml.say("No destination specified.");
    return twiml.toString();
  }
  // If callerId is undefined, Twilio may reject — prefer to have validated callerId
  const dialOptions = callerId ? { callerId } : {};
  twiml.dial(dialOptions, (d) => {
    d.number({}, toNumber);
  });
  return twiml.toString();
}

module.exports = {
  sendMessage,
  buildDialTwiML,
  getCallsByNumber,
  listTwilioNumbers,
  handleIncomingCall,
  generateAccessToken,
  getMessagesByNumber,
  handleIncomingMessage,
};
