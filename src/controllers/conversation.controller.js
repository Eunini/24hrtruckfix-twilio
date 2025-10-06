const { Mechanic, Ticket } = require("../models");
const Conversation = require("../models/conversation.model");
const messageService = require("../services/conversation.service");
const { markLeadAsContacted } = require("../services/process-campaign.service");
const twilioService = require("../services/message.services");

const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const normalizePhone = (p) => (p ? String(p).trim() : "");

/**
 * Generic programmatic send (used internally)
 * datas: { ticket_id?, to, body }
 */
exports.sendMessage = async (datas) => {
  try {
    const from = TWILIO_NUMBER;
    const { ticket_id, to, body } = datas;
    let otherPhone = to ? normalizePhone(to) : null;

    // infer phone from ticket if missing
    if (!otherPhone && ticket_id) {
      const ticket = await Ticket.findById(ticket_id).lean();
      if (ticket) {
        const ticketPhone = messageService.composeTicketPhone(ticket);
        if (ticketPhone) otherPhone = ticketPhone;
        else if (ticket.assigned_subcontractor) {
          const mech = await Mechanic.findById(
            ticket.assigned_subcontractor
          ).lean();
          if (mech && mech.mobileNumber)
            otherPhone = normalizePhone(mech.mobileNumber);
        }
      }
    }

    if (!otherPhone || !from || !body) {
      return console.error({
        message: "to (or ticket_id with a phone), from and body are required",
      });
    }

    const guessedRole = await messageService.determineRoleByPhone(otherPhone);
    const convo = await messageService.findOrCreateConversation({
      agentPhone: from,
      otherPhone,
      agentRole: "agent",
      otherRole: guessedRole === "driver" ? "driver" : "mechanic",
    });

    const msg = {
      from,
      to: otherPhone,
      body,
      status: "pending",
      createdAt: new Date(),
    };
    convo.messages.push(msg);
    convo.lastUpdatedAt = new Date();
    await convo.save();

    try {
      const twResp = await messageService.sendSms({
        to: otherPhone,
        from,
        body,
      });
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (m.twilioSid) continue;
        if (m.from === from && m.to === otherPhone && m.body === body) {
          m.twilioSid = twResp.sid;
          m.status = "sent";
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      await messageService.updateTicketsConvoStatusByPhones(
        [otherPhone],
        "unread"
      );
      return console.log({ message: "queued", twilioSid: twResp.sid });
    } catch (twErr) {
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (
          !m.twilioSid &&
          m.from === from &&
          m.to === otherPhone &&
          m.body === body
        ) {
          m.status = "failed";
          m.error = (twErr && twErr.message) || String(twErr);
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      return console.error({
        message: "Failed to send message via Twilio",
        error: twErr.message || twErr,
      });
    }
  } catch (err) {
    console.error("sendMessage error:", err);
  }
};

// Express handler: send to mechanic (HTTP)
exports.sendMechMessage = async (req, res) => {
  try {
    const from = TWILIO_NUMBER;
    const { ticket_id, to, body } = req.body;

    let otherPhone = to ? normalizePhone(to) : null;
    if (!otherPhone && ticket_id) {
      const ticket = await Ticket.findById(ticket_id).lean();
      if (ticket) {
        const ticketPhone = messageService.composeTicketPhone(ticket);
        if (ticketPhone) otherPhone = ticketPhone;
        else if (ticket.assigned_subcontractor) {
          const mech = await Mechanic.findById(
            ticket.assigned_subcontractor
          ).lean();
          if (mech && mech.mobileNumber)
            otherPhone = normalizePhone(mech.mobileNumber);
        }
      }
    }

    if (!otherPhone || !from || !body) {
      return res.status(400).json({
        message: "to (or ticket_id with a phone), from and body are required",
      });
    }

    const guessedRole = await messageService.determineRoleByPhone(otherPhone);
    const convo = await messageService.findOrCreateConversation({
      agentPhone: from,
      otherPhone,
      agentRole: "agent",
      otherRole: guessedRole === "driver" ? "driver" : "mechanic",
    });

    const msg = {
      from,
      to: otherPhone,
      body,
      status: "pending",
      createdAt: new Date(),
    };
    convo.messages.push(msg);
    convo.lastUpdatedAt = new Date();
    await convo.save();

    try {
      const twResp = await messageService.sendSms({
        to: otherPhone,
        from,
        body,
      });
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (m.twilioSid) continue;
        if (m.from === from && m.to === otherPhone && m.body === body) {
          m.twilioSid = twResp.sid;
          m.status = "sent";
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      await messageService.updateTicketsConvoStatusByPhones(
        [otherPhone],
        "unread"
      );
      return res.status(200).json({ message: "queued", twilioSid: twResp.sid });
    } catch (twErr) {
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (
          !m.twilioSid &&
          m.from === from &&
          m.to === otherPhone &&
          m.body === body
        ) {
          m.status = "failed";
          m.error = (twErr && twErr.message) || String(twErr);
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      return res.status(500).json({
        message: "Failed to send message via Twilio",
        error: twErr.message || twErr,
      });
    }
  } catch (err) {
    console.error("sendMechMessage error:", err);
    return res.status(500).json({ message: "Server error sending message" });
  }
};

// Driver HTTP send
exports.sendDriverMessage = async (req, res) => {
  // implementation same as sendMechMessage but otherRole 'driver' for conversation creation
  try {
    const from = TWILIO_NUMBER;
    const { ticket_id, to, body } = req.body;

    let otherPhone = to ? normalizePhone(to) : null;
    if (!otherPhone && ticket_id) {
      const ticket = await Ticket.findById(ticket_id).lean();
      if (ticket) {
        const ticketPhone = messageService.composeTicketPhone(ticket);
        if (ticketPhone) otherPhone = ticketPhone;
        else if (ticket.assigned_subcontractor) {
          const mech = await Mechanic.findById(
            ticket.assigned_subcontractor
          ).lean();
          if (mech && mech.mobileNumber)
            otherPhone = normalizePhone(mech.mobileNumber);
        }
      }
    }

    if (!otherPhone || !from || !body) {
      return res.status(400).json({
        message: "to (or ticket_id with a phone), from and body are required",
      });
    }

    const guessedRole = await messageService.determineRoleByPhone(otherPhone);
    const convo = await messageService.findOrCreateConversation({
      agentPhone: from,
      otherPhone,
      agentRole: "agent",
      otherRole: guessedRole === "mechanic" ? "mechanic" : "driver",
    });

    const msg = {
      from,
      to: otherPhone,
      body,
      status: "pending",
      createdAt: new Date(),
    };
    convo.messages.push(msg);
    convo.lastUpdatedAt = new Date();
    await convo.save();

    try {
      const twResp = await messageService.sendSms({
        to: otherPhone,
        from,
        body,
      });
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (m.twilioSid) continue;
        if (m.from === from && m.to === otherPhone && m.body === body) {
          m.twilioSid = twResp.sid;
          m.status = "sent";
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      await messageService.updateTicketsConvoStatusByPhones(
        [otherPhone],
        "unread"
      );
      return res.status(200).json({ message: "queued", twilioSid: twResp.sid });
    } catch (twErr) {
      const convoDoc = await Conversation.findById(convo._id);
      for (let i = convoDoc.messages.length - 1; i >= 0; i--) {
        const m = convoDoc.messages[i];
        if (
          !m.twilioSid &&
          m.from === from &&
          m.to === otherPhone &&
          m.body === body
        ) {
          m.status = "failed";
          m.error = (twErr && twErr.message) || String(twErr);
          break;
        }
      }
      convoDoc.lastUpdatedAt = new Date();
      await convoDoc.save();
      return res.status(500).json({
        message: "Failed to send message via Twilio",
        error: twErr.message || twErr,
      });
    }
  } catch (err) {
    console.error("sendDriverMessage error:", err);
    return res.status(500).json({ message: "Server error sending message" });
  }
};

// Get messages for a ticket (derive conversation by ticket phones)
exports.getMessagesByTicket = async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    if (!ticketId) return res.status(400).json({ message: "Ticket required" });

    // find ticket and derive phones
    const ticket = await Ticket.findById(ticketId).lean();
    if (!ticket)
      return res.status(200).json({ conversation: null, messages: [] });

    const phones = [];
    const ticketPhone = messageService.composeTicketPhone(ticket);
    if (ticketPhone) otherPhone = ticketPhone;
    if (ticket.assigned_subcontractor) {
      const mech = await Mechanic.findById(
        ticket.assigned_subcontractor
      ).lean();
      if (mech && mech.mobileNumber)
        phones.push(normalizePhone(mech.mobileNumber));
    }

    const convo = await Conversation.findOne({
      "participants.phone": { $in: phones },
    })
      .sort({ lastUpdatedAt: -1 })
      .lean();
    if (!convo)
      return res.status(200).json({ conversation: null, messages: [] });

    const msgs = (convo.messages || []).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const trimmed = msgs.slice(-200);
    return res.status(200).json({ conversation: convo, messages: trimmed });
  } catch (err) {
    console.error("getMechMessagesByTicket error:", err);
    return res.status(500).json({ message: "Server error fetching messages" });
  }
};

exports.markTicketMessagesRead = async (req, res) => {
  try {
    const ticketId =
      req.params.ticketId || req.body.ticket_id || req.body.ticketId;
    const roleFilter = req.body.role;

    if (!ticketId)
      return res.status(400).json({ ok: false, error: "ticketId required" });

    const ticket = await Ticket.findById(ticketId);
    if (!ticket)
      return res.status(404).json({ ok: false, error: "Ticket not found" });

    const phones = [];
    const ticketPhone = messageService.composeTicketPhone(ticket);
    if (ticketPhone) phones.push(ticketPhone);

    if (ticket.assigned_subcontractor) {
      const mech = await Mechanic.findById(
        ticket.assigned_subcontractor
      ).lean();
      if (mech && mech.mobileNumber)
        phones.push(normalizePhone(mech.mobileNumber));
    }

    if (phones.length === 0)
      return res
        .status(400)
        .json({ ok: false, error: "No phones found on ticket" });

    // find the most-recent conversation containing any of these phones
    const convo = await Conversation.findOne({
      "participants.phone": { $in: phones },
    }).sort({ lastUpdatedAt: -1 });
    if (!convo)
      return res.status(200).json({
        ok: true,
        updated: 0,
        message: "No conversation found for ticket phones",
      });

    const agentPhones = (convo.participants || [])
      .filter((p) => p && (p.role === "agent" || p.role === "user"))
      .map((p) => normalizePhone(p.phone));
    const agentSet = new Set(agentPhones.filter(Boolean));
    if (agentSet.size === 0)
      return res
        .status(400)
        .json({ ok: false, error: "No agent phones found in conversation" });

    let updated = 0;
    convo.messages.forEach((m) => {
      if (!m || !m.to) return;
      if (agentSet.has(normalizePhone(m.to))) {
        if (m.status === "pending" || m.status === "sent") {
          if (roleFilter && m.role && String(m.role) !== String(roleFilter))
            return;
          m.status = "delivered";
          m.read = true;
          updated++;
        }
      }
    });

    if (updated > 0) {
      convo.lastUpdatedAt = new Date();
      await convo.save();
    }

    // update ticket convo_status to read for the relevant agent phones
    const count = await messageService.updateTicketsConvoStatusByPhones(
      agentPhones,
      "read"
    );

    if (count === 0) {
      ticket.convo_status = "read";
      await ticket.save();
    }

    return res.status(200).json({
      ok: true,
      updated,
      convoId: convo._id,
      status: ticket.convo_status,
    });
  } catch (err) {
    console.error("markTicketMessagesRead error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};

/**
 * Unified Twilio webhook:
 * - incoming message (Body + From + MessageSid) => append message to conversation and return latest 60 messages from last 60 days
 * - delivery callback (MessageSid + MessageStatus) => update embedded message status
 * - client mark-as-read by convo_id or ticket_id => update statuses
 */
exports.statusCallback = async (req, res) => {
  console.log(req.body);
  try {
    const body = req.body.Body || req.body.body;
    const messageSid =
      req.body.MessageSid || req.body.messageSid || req.body.MessageSID;
    const messageStatus =
      req.body.SmsStatus || req.body.smsStatus || req.body.status;
    const from = req.body.From || req.body.from;
    const to = req.body.To || req.body.to;
    markLeadAsContacted(from, body);

    // early dedupe: ignore if we already have this twilioSid
    if (messageSid) {
      const existing = await Conversation.findOne({
        "messages.twilioSid": messageSid,
      })
        .select("_id")
        .lean();
      if (existing) {
        // respond ok to avoid Twilio retries
        return res
          .status(200)
          .json({ ok: true, message: "duplicate", convoId: existing._id });
      }
    }

    // Incoming message handling
    if (body && from && messageSid) {
      try {
        const saved = await twilioService.handleIncomingMessage(req.body);
        if (saved) {
          console.log("Saved to Message Collection");
        }
      } catch (msgError) {
        console.error(
          "Failed to save incoming message to Message collection:",
          msgError
        );
      }

      const fromPhone = normalizePhone(from);
      const toPhone = normalizePhone(to || TWILIO_NUMBER);
      const twilioNumber = normalizePhone(TWILIO_NUMBER);

      // determine which is agent and which is external
      let agentPhone, externalPhone;
      if (fromPhone === twilioNumber) {
        agentPhone = fromPhone;
        externalPhone = toPhone;
      } else if (toPhone === twilioNumber) {
        agentPhone = toPhone;
        externalPhone = fromPhone;
      } else {
        agentPhone = toPhone || twilioNumber;
        externalPhone = fromPhone;
      }

      const otherRole = await messageService.determineRoleByPhone(
        externalPhone
      );
      const convo = await messageService.findOrCreateConversation({
        agentPhone,
        agentRole: "agent",
        otherPhone: externalPhone,
        otherRole,
      });

      const msg = {
        from: fromPhone,
        to: toPhone || twilioNumber,
        body,
        status: "received",
        twilioSid: messageSid,
        createdAt: new Date(),
        read: false,
      };

      convo.messages.push(msg);
      convo.lastUpdatedAt = new Date();
      await convo.save();

      // mark related tickets unread
      await messageService.updateTicketsConvoStatusByPhones(
        [externalPhone],
        "unread"
      );

      // return latest 60 messages from last 60 days
      const recentMsgs = messageService.getRecentMessages(convo, 60, 60);
      return res
        .status(200)
        .json({ ok: true, convoId: convo._id, messages: recentMsgs });
    }

    // Delivery/status callback by MessageSid
    if (messageSid && messageStatus) {
      const mapState = (s, fallback) => {
        if (!s) return fallback || "pending";
        const st = String(s).toLowerCase();
        if (["delivered", "read", "received"].includes(st)) return "delivered";
        if (["failed", "undelivered", "delivery-failed"].includes(st))
          return "failed";
        if (["sent", "accepted", "queued"].includes(st)) return "sent";
        return st;
      };

      const convo = await Conversation.findOne({
        "messages.twilioSid": messageSid,
      });
      if (!convo) {
        // try a reconciliation fetch (optional)
        await messageService.fetchAndAssignTwilioMessages({
          sinceDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        return res.status(200).json({ ok: true, updated: 0, by: "messageSid" });
      }

      const found = convo.messages.find(
        (m) =>
          String(m.twilioSid) === String(messageSid) ||
          String(m._id) === String(messageSid)
      );
      if (!found)
        return res.status(200).json({ ok: true, updated: 0, by: "messageSid" });

      const newStatus = mapState(messageStatus, found.status);
      found.status = newStatus;
      if (newStatus === "delivered") found.read = true;

      await convo.save();

      // derive phones from message to update tickets
      const phonesToUpdate = [
        normalizePhone(found.to),
        normalizePhone(found.from),
      ].filter(Boolean);
      await messageService.updateTicketsConvoStatusByPhones(
        phonesToUpdate,
        "read"
      );

      return res
        .status(200)
        .json({ ok: true, updated: 1, by: "messageSid", status: found.status });
    }

    // mark-as-read / client requests: by convo_id or ticket_id
    const convo_id =
      req.body.convo_id || req.body.conversation_id || req.body.convoId;
    const ticket_id = req.body.ticket_id || req.body.ticketId;
    const agentPhoneProvided =
      req.body.agentPhone || req.body.agent_phone || req.body.phone;
    const roleFilter = req.body.role;

    if (convo_id) {
      const convo = await Conversation.findById(convo_id);
      if (!convo)
        return res.status(200).json({ ok: true, updated: 0, by: "convo_id" });

      const agentPhones = agentPhoneProvided
        ? [normalizePhone(agentPhoneProvided)]
        : (convo.participants || [])
            .filter((p) => p && (p.role === "agent" || p.role === "user"))
            .map((p) => normalizePhone(p.phone));
      const agentSet = new Set(agentPhones.filter(Boolean));
      let updated = 0;

      convo.messages.forEach((m) => {
        if (!m || !m.to) return;
        if (agentSet.has(normalizePhone(m.to))) {
          if (m.status === "pending" || m.status === "sent") {
            if (roleFilter && m.role && String(m.role) !== String(roleFilter))
              return;
            m.status = "delivered";
            m.read = true;
            updated++;
          }
        }
      });

      if (updated > 0) {
        convo.lastUpdatedAt = new Date();
        await convo.save();
      }

      await messageService.updateTicketsConvoStatusByPhones(
        agentPhones,
        "read"
      );
      return res.status(200).json({ ok: true, updated, by: "convo_id" });
    }

    if (ticket_id) {
      const ticket = await Ticket.findById(ticket_id).lean();
      if (!ticket)
        return res.status(200).json({ ok: true, updated: 0, by: "ticket_id" });

      const phones = [];
      const ticketPhone = messageService.composeTicketPhone(ticket);
      if (ticketPhone) otherPhone = ticketPhone;
      if (ticket.assigned_subcontractor) {
        const mech = await Mechanic.findById(
          ticket.assigned_subcontractor
        ).lean();
        if (mech && mech.mobileNumber)
          phones.push(normalizePhone(mech.mobileNumber));
      }

      const convo = await Conversation.findOne({
        "participants.phone": { $in: phones },
      }).sort({ lastUpdatedAt: -1 });
      if (!convo)
        return res.status(200).json({ ok: true, updated: 0, by: "ticket_id" });

      const agentPhones = (convo.participants || [])
        .filter((p) => p && (p.role === "agent" || p.role === "user"))
        .map((p) => normalizePhone(p.phone));
      const agentSet = new Set(agentPhones.filter(Boolean));
      let updated = 0;

      convo.messages.forEach((m) => {
        if (!m || !m.to) return;
        if (agentSet.has(normalizePhone(m.to))) {
          if (m.status === "pending" || m.status === "sent") {
            if (roleFilter && m.role && String(m.role) !== String(roleFilter))
              return;
            m.status = "delivered";
            m.read = true;
            updated++;
          }
        }
      });

      if (updated > 0) {
        convo.lastUpdatedAt = new Date();
        await convo.save();
      }

      await messageService.updateTicketsConvoStatusByPhones(
        agentPhones,
        "read"
      );
      return res.status(200).json({ ok: true, updated, by: "ticket_id" });
    }

    return res.status(400).json({
      ok: false,
      error:
        "Missing parameters. Provide incoming message fields OR MessageSid OR convo_id OR ticket_id",
    });
  } catch (err) {
    console.error("statusCallback error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};

exports.getDriverMessagesByTicket = exports.getMessagesByTicket;
exports.getMechMessagesByTicket = exports.getMessagesByTicket;
