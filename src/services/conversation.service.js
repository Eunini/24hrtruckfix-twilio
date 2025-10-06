const Twilio = require("twilio");
const { Mechanic, Ticket } = require("../models");
const Conversation = require("../models/conversation.model");
const UnassignedMessage = require("../models/unassignedMessage.model");
const Message = require("../models/message.model");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const defaultTwilioNumber = process.env.TWILIO_PHONE_NUMBER;
if (!accountSid || !authToken) {
  console.warn(
    "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set. Twilio disabled."
  );
}

const client = accountSid && authToken ? Twilio(accountSid, authToken) : null;
const normalizePhone = (p) => (p ? String(p).trim() : "");

const buildStatusCallbackUrl = () => {
  const root =
    process.env.WEBHOOK_URL || "https://two4hourservice-backend.onrender.com";
  return `${root}/api/v1/messages/incoming`;
};

async function sendSms({ to, body }) {
  if (!client) {
    const err = new Error(
      "Twilio client not configured (missing accountSid/authToken)."
    );
    err.isTwilio = false;
    throw err;
  }
  if (!defaultTwilioNumber) {
    throw new Error("TWILIO_PHONE_NUMBER env var not set");
  }

  const payload = {
    to,
    from: defaultTwilioNumber,
    body,
    statusCallback: buildStatusCallbackUrl(),
  };

  // retry helper (exponential backoff). Retries the provided function up to `attempts`.
  const retry = async (fn, attempts = 3, initialDelayMs = 500) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === attempts) {
          console.error(`All ${attempts} attempts to call Twilio failed.`);
          throw err;
        }
        const delay = initialDelayMs * Math.pow(2, attempt - 1); // 500, 1000, 2000 ms
        console.warn(`Twilio attempt ${attempt} failed. Retrying in ${delay}ms...`, err && err.message);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  };

  try {
    // Only retry the Twilio network call
    const twResp = await retry(() => client.messages.create(payload), 3, 500);

    if (twResp) {
      try {
        const doc = {
          sid: twResp.sid,
          from: normalizeNumber(twResp.from || defaultTwilioNumber),
          to: normalizeNumber(twResp.to || to),
          body: twResp.body || body,
          dateSent: twResp.dateSent ? new Date(twResp.dateSent) : null,
          dateCreated: twResp.dateCreated ? new Date(twResp.dateCreated) : new Date(),
          direction: "outbound-api",
          status: twResp.status || "queued",
        };

        const saved = await Message.findOneAndUpdate(
          { sid: twResp.sid },
          { $set: doc },
          { upsert: true, new: true, lean: true }
        );

        if (saved) {
          console.log("Saved to Message Collection");
        }
      } catch (msgError) {
        // Log but don't fail the whole operation if DB save fails
        console.error("Failed to save outgoing message to Message collection:", msgError);
      }
    }

    return twResp;
  } catch (err) {
    // Twilio error object has useful fields: status, code, message, moreInfo
    console.error("Twilio send error:", {
      status: err && err.status,
      code: err && err.code,
      message: err && err.message,
      moreInfo: err && err.moreInfo,
    });

    const error = new Error(`Twilio error: ${err && err.message}`);
    error.twilio = {
      status: err && err.status,
      code: err && err.code,
      moreInfo: err && err.moreInfo,
    };
    throw error;
  }
}

/**
 * Poll Twilio for messages between conversation participants and twilioNumber since last stored message.
 */
async function pollConversationMessages(conversationId, options = {}) {
  if (!client) return [];
  const convo = await Conversation.findById(conversationId).lean();
  if (!convo) return [];

  const twilioNumber = convo.twilioNumber || defaultTwilioNumber;
  const lastStored =
    convo.messages && convo.messages.length
      ? new Date(convo.messages[convo.messages.length - 1].createdAt)
      : options.sinceDate || new Date(0);

  const newMessages = [];
  const participantPhones = (convo.participants || [])
    .map((p) => p.phone)
    .filter(Boolean);
  if (!participantPhones.length) return [];

  const sinceISO = lastStored.toISOString();

  try {
    // messages to our twilio number from participant phones
    for (const p of participantPhones) {
      const inbound = await client.messages.list({
        to: twilioNumber,
        from: p,
        dateSentAfter: lastStored,
        limit: 50,
      });
      for (const m of inbound.reverse()) {
        // Twilio returns newest first; reverse to append oldest-first
        if (new Date(m.dateSent) <= lastStored) continue;
        newMessages.push({
          from: m.from,
          to: m.to,
          body: m.body,
          twilioSid: m.sid,
          status: m.status || "received",
          createdAt: m.dateSent ? new Date(m.dateSent) : new Date(),
        });
      }
    }

    // our twilio number -> client
    for (const p of participantPhones) {
      const outbound = await client.messages.list({
        from: twilioNumber,
        to: p,
        dateSentAfter: lastStored,
        limit: 50,
      });
      for (const m of outbound.reverse()) {
        if (new Date(m.dateSent) <= lastStored) continue;
        newMessages.push({
          from: m.from,
          to: m.to,
          body: m.body,
          twilioSid: m.sid,
          status: m.status || "sent",
          createdAt: m.dateSent ? new Date(m.dateSent) : new Date(),
        });
      }
    }
  } catch (err) {
    console.error(
      "Error polling Twilio for conversation",
      conversationId,
      err.message || err
    );
  }

  // Insert newMessages into conversation (if any), de-duplicate by twilioSid
  if (newMessages.length) {
    const convoDoc = await Conversation.findById(conversationId);
    const existingSids = new Set(
      (convoDoc.messages || []).map((m) => m.twilioSid).filter(Boolean)
    );
    for (const nm of newMessages) {
      if (nm.twilioSid && existingSids.has(nm.twilioSid)) continue;
      convoDoc.messages.push(nm);
      convoDoc.lastUpdatedAt = new Date();
    }
    await convoDoc.save();
    return newMessages;
  }
  return [];
}

/**
 * startPolling(intervalMs)
 * Call this from your main app if you want periodic reconciliation.
 */
function singlePolling(conversationId, intervalMs = 60 * 1000) {
  let timer = null;
  const start = () => {
    if (timer) return;
    timer = setInterval(async () => {
      try {
        await pollConversationMessages(conversationId);
      } catch (e) {
        console.error("Poll single conversation error:", e.message || e);
      }
    }, intervalMs);
  };
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  return { start, stop };
}

async function vapiSendTwilloMessage({ to, body, from }) {
  if (!client) {
    const err = new Error(
      "Twilio client not configured (missing accountSid/authToken)."
    );
    err.isTwilio = false;
    throw err;
  }

  const payload = {
    to,
    from: from || defaultTwilioNumber,
    body,
  };

  try {
    const twResp = await client.messages.create(payload);
    return twResp;
  } catch (err) {
    console.error("Error sending SMS with Twilio:", err.message || err);
    throw err;
  }
}

async function fetchAndAssignTwilioMessages({
  sinceDate = new Date(0),
  limit = 200,
} = {}) {
  if (!client) {
    throw new Error("Twilio client not configured");
  }

  if (!sinceDate || !(sinceDate instanceof Date)) {
    sinceDate = new Date(sinceDate);
  }

  const twilioNumber = defaultTwilioNumber;
  if (!twilioNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not set");
  }

  let twMessages = [];
  try {
    twMessages = await client.messages.list({
      dateSentAfter: sinceDate,
      limit,
    });
  } catch (err) {
    console.error("Error fetching messages from Twilio:", err && err.message);
    throw err;
  }

  // Twilio returns newest-first; process oldest-first
  twMessages = twMessages.reverse();

  const assigned = [];
  const skippedDuplicates = [];
  const savedUnassigned = [];
  const unassigned = [];

  for (const m of twMessages) {
    try {
      const sid = m.sid;
      if (!sid) {
        // no sid? save to unassigned for inspection
        const saved = await UnassignedMessage.create({
          twilioSid: null,
          from: m.from || "",
          to: m.to || "",
          body: m.body || "",
          dateSent: m.dateSent ? new Date(m.dateSent) : new Date(),
          reason: "no_sid",
        });
        savedUnassigned.push({ sid: null, id: saved._id, reason: "no_sid" });
        continue;
      }

      // 1) Deduplicate by MESSAGE SID across all conversations
      const already = await Conversation.findOne({
        "messages.twilioSid": sid,
      }).lean();
      if (already) {
        skippedDuplicates.push({
          sid,
          reason: "already_saved",
          convoId: already._id,
        });
        continue;
      }

      const from = String(m.from || "").trim();
      const to = String(m.to || "").trim();
      const dateSent = m.dateSent
        ? new Date(m.dateSent)
        : m.dateCreated
        ? new Date(m.dateCreated)
        : new Date();

      let participantPhone = null;
      let direction = null;
      if (to === twilioNumber) {
        participantPhone = from;
        direction = "inbound";
      } else if (from === twilioNumber) {
        participantPhone = to;
        direction = "outbound";
      } else {
        // message not involving our twilio number
        const saved = await UnassignedMessage.create({
          twilioSid: sid,
          from,
          to,
          body: m.body || "",
          dateSent,
          reason: "not_involving_twilio_number",
          // raw: m,
        });
        savedUnassigned.push({
          sid,
          id: saved._id,
          reason: "not_involving_twilio_number",
        });
        continue;
      }

      // 2) Find candidate conversations that include BOTH the participant phone and the twilioNumber.
      const candidates = await Conversation.find({
        "participants.phone": { $all: [participantPhone, twilioNumber] },
      })
        .sort({ lastUpdatedAt: -1 })
        .exec();

      if (!candidates || candidates.length === 0) {
        // Save to Unassigned for manual mapping (include suggested phone)
        const saved = await UnassignedMessage.create({
          twilioSid: sid,
          from,
          to,
          body: m.body || "",
          dateSent,
          reason: "no_conversation_with_both_phones",
          // raw: m,
        });
        savedUnassigned.push({
          sid,
          id: saved._id,
          reason: "no_conversation_with_both_phones",
        });
        continue;
      }

      // 3) Choose best candidate (prefer open, then minimal time diff)
      let chosen = null;
      if (candidates.length === 1) {
        chosen = candidates[0];
      } else {
        const openCandidates = candidates.filter((c) => c.status === "open");
        const pool = openCandidates.length ? openCandidates : candidates;

        let bestDiff = Number.POSITIVE_INFINITY;
        for (const c of pool) {
          const last = c.lastUpdatedAt
            ? new Date(c.lastUpdatedAt)
            : new Date(0);
          const diff = Math.abs(dateSent.getTime() - last.getTime());
          if (diff < bestDiff) {
            bestDiff = diff;
            chosen = c;
          }
        }
      }

      if (!chosen) {
        const saved = await UnassignedMessage.create({
          twilioSid: sid,
          from,
          to,
          body: m.body || "",
          dateSent,
          reason: "no_confident_candidate",
          // raw: m,
        });
        savedUnassigned.push({
          sid,
          id: saved._id,
          reason: "no_confident_candidate",
        });
        continue;
      }

      // 4) Double-check race-condition (ensure chosen doesn't suddenly contain the SID)
      const convoDoc = await Conversation.findById(chosen._id);
      const existsInChosen = (convoDoc.messages || []).some(
        (x) => String(x.twilioSid) === String(sid)
      );
      if (existsInChosen) {
        skippedDuplicates.push({
          sid,
          reason: "appeared_in_candidate",
          convoId: convoDoc._id,
        });
        continue;
      }

      // Build message and append
      const msgObj = {
        from,
        to,
        body: m.body || "",
        status: m.status
          ? String(m.status)
          : direction === "inbound"
          ? "received"
          : "sent",
        twilioSid: sid,
        createdAt: dateSent,
      };

      convoDoc.messages.push(msgObj);
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();

      // update ticket status if present
      try {
        if (convoDoc.ticket_id) {
          const ticket = await Ticket.findById(convoDoc.ticket_id);
          if (ticket) {
            ticket.convo_status = "unread";
            await ticket.save();
          }
        }
      } catch (tErr) {
        console.warn(
          "Failed to update ticket convo_status:",
          tErr && tErr.message
        );
      }

      assigned.push({ sid, convoId: convoDoc._id, message: msgObj });
    } catch (procErr) {
      console.error(
        "Error processing Twilio message in fetchAndAssignTwilioMessages:",
        procErr && procErr.stack ? procErr.stack : procErr
      );
      // save the failing message raw for debugging if possible
      try {
        const saved = await UnassignedMessage.create({
          twilioSid: (m && m.sid) || null,
          from: (m && m.from) || "",
          to: (m && m.to) || "",
          body: (m && m.body) || "",
          dateSent:
            (m &&
              (m.dateSent
                ? new Date(m.dateSent)
                : m.dateCreated
                ? new Date(m.dateCreated)
                : new Date())) ||
            new Date(),
          reason: "processing_error",
          // raw: m,
        });
        savedUnassigned.push({
          sid: (m && m.sid) || null,
          id: saved._id,
          reason: "processing_error",
        });
      } catch (saveErr) {
        unassigned.push({
          reason: "processing_error_and_save_failed",
          error: procErr && procErr.message,
        });
      }
    }
  } // end for loop

  return {
    assigned,
    skippedDuplicates,
    savedUnassigned,
    unassigned,
    totalPolled: twMessages.length,
  };
}

function composeTicketPhone(ticket) {
  if (!ticket) return "";
  const dial = ticket?.cell_country_code?.dialCode || "";
  const num = ticket?.current_cell_number || "";
  return normalizePhone(`${dial}${num}`);
}

async function determineRoleByPhone(phone) {
  const p = normalizePhone(phone);
  if (!p) return null;

  const mech = await Mechanic.findOne({ mobileNumber: p })
    .select("_id mobileNumber")
    .lean();
  if (mech) return "mechanic";

  const ticket = await Ticket.findOne({
    $expr: {
      $eq: [
        {
          $concat: [
            { $ifNull: ["$cell_country_code.dialCode", ""] },
            { $ifNull: ["$current_cell_number", ""] },
          ],
        },
        p,
      ],
    },
  })
    .select("_id current_cell_number cell_country_code")
    .lean();
  if (ticket) return "driver";

  // fallback
  return "user";
}

// Find or create a conversation given agentPhone and otherPhone + roles
async function findOrCreateConversation({
  agentPhone,
  agentRole = "agent",
  otherPhone,
  otherRole = "mechanic",
}) {
  agentPhone = normalizePhone(agentPhone);
  otherPhone = normalizePhone(otherPhone);
  if (!otherPhone) throw new Error("otherPhone required");

  // Try to find conversation containing both phones
  let convo = await Conversation.findOne({
    "participants.phone": { $all: [agentPhone, otherPhone] },
  });

  // fallback: find convo with otherPhone and role
  if (!convo) {
    convo = await Conversation.findOne({
      "participants.phone": otherPhone,
      "participants.role": otherRole,
    }).sort({ lastUpdatedAt: -1 });
  }

  if (!convo) {
    const participants = [
      { phone: agentPhone, role: agentRole },
      { phone: otherPhone, role: otherRole },
    ];
    convo = new Conversation({
      participants,
      messages: [],
      lastUpdatedAt: new Date(),
    });
    await convo.save();
    return convo;
  }

  // ensure participants include both numbers
  const phones = (convo.participants || []).map((p) => normalizePhone(p.phone));
  let mutated = false;
  if (agentPhone && !phones.includes(agentPhone)) {
    convo.participants.push({ phone: agentPhone, role: agentRole });
    mutated = true;
  }
  if (otherPhone && !phones.includes(otherPhone)) {
    convo.participants.push({ phone: otherPhone, role: otherRole });
    mutated = true;
  }
  if (mutated) {
    convo.lastUpdatedAt = new Date();
    await convo.save();
  }
  return convo;
}

// Update Ticket.convo_status for tickets that relate to any of the given phones
async function updateTicketsConvoStatusByPhones(phones = [], status) {
  if (!phones || phones.length === 0) return 0;

  const normalized = phones.map(normalizePhone).filter(Boolean);
  if (normalized.length === 0) return 0;

  // mechanics whose mobileNumber is in phones
  const mechanics = await Mechanic.find({ mobileNumber: { $in: normalized } })
    .select("_id")
    .lean();
  const mechIds = mechanics.map((m) => m._id);

  const query = {
    $or: [
      {
        $expr: {
          $in: [
            {
              $concat: [
                { $ifNull: ["$cell_country_code.dialCode", ""] },
                { $ifNull: ["$current_cell_number", ""] },
              ],
            },
            normalized,
          ],
        },
      },
      { assigned_subcontractor: { $in: mechIds } },
    ],
  };

  const res = await Ticket.updateMany(query, {
    $set: { convo_status: status },
  });
  // return number modified
  // console.log({status})
  // console.log(res.convo_status, res.modifiedCount, res.nModified, res)
  return res.modifiedCount || res.nModified || 0;
}

// Return recent messages from convo within last `days` up to `limit` messages (ascending)
function getRecentMessages(convo, days = 60, limit = 60) {
  if (!convo) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const msgs = (convo.messages || []).filter(
    (m) => new Date(m.createdAt).getTime() >= cutoff
  );
  const sortedDesc = msgs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return sortedDesc.sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

module.exports = {
  sendSms,
  pollConversationMessages,
  singlePolling,
  vapiSendTwilloMessage,
  fetchAndAssignTwilioMessages,
  getRecentMessages,
  composeTicketPhone,
  determineRoleByPhone,
  findOrCreateConversation,
  updateTicketsConvoStatusByPhones,
};
