/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");
const fetch = (typeof global.fetch !== "function") ? require("node-fetch") : global.fetch;
const Request = require("../models/request.model");
const Ticket = require("../models/ticket.model");
const vapiService = require("./vapi.service"); // <- path you asked for
const createDispatchOutboundAgent = vapiService.createDispatchOutboundAgent;

/** Connect guard */
// async function connectDB() {
//   if (mongoose.connection.readyState >= 1) return;
//   const uri = process.env.MONGODB_URI;
//   if (!uri) throw new Error("MONGO_URI not set in environment");
//   await mongoose.connect(uri);
//   console.log("✅ MongoDB connected");
// }

/** Extract JSON block from free text/object */
function parseAssistantJson(aiResponseText) {
  if (!aiResponseText) return null;
  if (typeof aiResponseText === "object") return aiResponseText;
  const s = String(aiResponseText).trim();

  try {
    return JSON.parse(s);
  } catch (err) {
    // not pure JSON, try extract block
  }

  const match = s.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (err) {
    try {
      const cleaned = match[0].replace(/[\r\n]+/g, " ");
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }
}

/** Sum service costs */
function computeTotalFromServices(services) {
  if (!Array.isArray(services) || services.length === 0) return null;
  return services.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
}

/** Map assistant action -> Request.status enum */
function mapActionToStatus(action) {
  if (!action) return "wait";
  const a = String(action).toLowerCase();
  if (a === "save" || a === "agreed") return "agreed";
  if (a === "declined") return "declined";
  return "wait";
}

/**
 * Build payload for Vapi call by getting base assistant config from vapi.service,
 * then cloning it and injecting ticket_id/sp_id into metadata for this run.
 */
async function buildVapiPayload(orgName, orgId, ticketId, mechanicId) {
  const base = await createDispatchOutboundAgent(orgName, orgId);

  let assistantConfig = base && base.assistant ? base.assistant : base;

  if (!assistantConfig || typeof assistantConfig !== "object") {
    assistantConfig = base;
  }

  const cloned = JSON.parse(JSON.stringify(assistantConfig));

  // ensure metadata exists and inject ticket/sp
  cloned.metadata = cloned.metadata || {};
  cloned.metadata.ticket_id = String(ticketId);
  cloned.metadata.sp_id = String(mechanicId);

  // Return top-level wrapper expected by Vapi (matches earlier examples)
  return { assistant: cloned };
}

/**
 * Perform one Vapi POST call with provided payload.
 * Returns parsed JSON body (as JS object) or throws.
 */
async function callVapi(payload) {
  const VAPI_URL = "https://api.vapi.ai/assistant";
  const VAPI_KEY = process.env.VAPI_API_KEY;
  if (!VAPI_KEY) throw new Error("VAPI_API_KEY (or VAPI_KEY) not set in environment");

  const resp = await fetch(VAPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VAPI_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`VAPI request failed: ${resp.status} ${resp.statusText} ${txt}`);
  }
  const data = await resp.json();
  return data;
}

/**
 * Main: run 5 sequential calls using createDispatchOutboundAgent from ./vapi.service,
 * parse the assistant output, and save results to Request collection (exact schema fields).
 *
 * @param ticketId (ObjectId or string)
 * @param mechanicId (ObjectId or string)
 * @param orgName (string)
 * @param orgId (ObjectId or string)
 * @param opts { attempts: number (default 5), delayMs: number }
 */
exports.SpVapiCalls = async (ticketId, mechanicId, orgName, orgId) => {
  // await connectDB();

  const attempts = 5;
  const delayMs = 500;

  // quick guard: ticket must exist
  const exists = await Ticket.exists({ _id: ticketId });
  if (!exists) throw new Error("Ticket not found: " + ticketId);

  const saved = [];

  for (let i = 0; i < attempts; i++) {
    console.log(`📞 VAPI call ${i + 1}/${attempts} for ticket=${ticketId}, mechanic=${mechanicId}`);

    // 1) build payload by calling your external helper
    let payload;
    try {
      payload = await buildVapiPayload(orgName, orgId, ticketId, mechanicId);
    } catch (err) {
      console.error("❌ Error building VAPI payload from createDispatchOutboundAgent:", err && err.message ? err.message : err);
      // save a wait entry so operator sees issue
      const docFail = await Request.create({
        ticket_id: ticketId,
        mechanic_id: mechanicId,
        services: [],
        total_cost: null,
        eta: null,
        status: "wait",
        notes: `Failed to build VAPI payload on attempt ${i + 1}: ${err && err.message ? err.message : "unknown"}`,
      });
      saved.push(docFail);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    // 2) call Vapi
    let vapiResp;
    try {
      vapiResp = await callVapi(payload);
      console.log("VAPI raw response:", vapiResp);
    } catch (err) {
      console.error("❌ VAPI call error:", err && err.message ? err.message : err);
      const docFail = await Request.create({
        ticket_id: ticketId,
        mechanic_id: mechanicId,
        services: [],
        total_cost: null,
        eta: null,
        status: "wait",
        notes: `VAPI call failed on attempt ${i + 1}: ${err && err.message ? err.message : "unknown"}`,
      });
      saved.push(docFail);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    // 3) Extract assistant text from VAPI response (possible shapes: data.output, data.result, data.choices, etc.)
    let assistantText = null;
    try {
      if (!vapiResp) assistantText = null;
      else if (typeof vapiResp === "string") assistantText = vapiResp;
      else if (vapiResp.output && typeof vapiResp.output === "string") assistantText = vapiResp.output;
      else if (vapiResp.result && typeof vapiResp.result === "string") assistantText = vapiResp.result;
      else if (Array.isArray(vapiResp.choices) && vapiResp.choices[0]) {
        const c = vapiResp.choices[0];
        assistantText = c.message?.content || c.output || c.text || JSON.stringify(c);
      } else if (vapiResp.message && vapiResp.message.content) {
        assistantText = vapiResp.message.content;
      } else {
        // fallback stringify
        assistantText = JSON.stringify(vapiResp);
      }
    } catch (err) {
      assistantText = JSON.stringify(vapiResp);
    }

    console.log("Assistant text (attempt):", assistantText);

    // 4) parse assistant JSON
    const parsed = parseAssistantJson(assistantText);
    if (!parsed) {
      console.warn("⚠️ Could not parse assistant JSON — saving placeholder Request (status=wait).");
      const doc = await Request.create({
        ticket_id: ticketId,
        mechanic_id: mechanicId,
        services: [],
        total_cost: null,
        eta: null,
        status: "wait",
        notes: `Unparsed assistant response on attempt ${i + 1}`,
      });
      saved.push(doc);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    // 5) normalize services
    const rawServices = Array.isArray(parsed.services) ? parsed.services : [];
    const services = rawServices
      .map((s) => {
        if (!s) return null;
        const name = s.name || s.service || null;
        const cost = Number(s.cost ?? s.price ?? s.amount ?? NaN);
        if (!name || Number.isNaN(cost)) return null;
        const out = { name: String(name), cost };
        if (s.id) out.id = String(s.id);
        return out;
      })
      .filter(Boolean);

    // 6) total_cost
    let total_cost = null;
    if (parsed.total_cost !== undefined && parsed.total_cost !== null) {
      total_cost = Number(parsed.total_cost);
      if (Number.isNaN(total_cost)) total_cost = null;
    }
    if ((total_cost === null || total_cost === undefined) && services.length > 0) {
      total_cost = computeTotalFromServices(services);
    }

    // 7) eta, status, notes
    const eta = parsed.eta ? String(parsed.eta) : null;
    const status = mapActionToStatus(parsed.action ?? parsed.status);
    const notes = parsed.notes ? String(parsed.notes) : "";

    // 8) Save only allowed schema fields
    const savedDoc = await Request.create({
      ticket_id: ticketId,
      mechanic_id: mechanicId,
      services,
      total_cost: total_cost ?? null,
      eta,
      status,
      notes,
    });

    console.log(`💾 Saved Request (attempt ${i + 1}) id=${savedDoc._id} status=${status} total_cost=${total_cost} eta=${eta}`);
    saved.push(savedDoc);

    // delay before next call
    await new Promise((r) => setTimeout(r, delayMs));
  }

  console.log(`✅ Completed ${attempts} Vapi calls for ticket ${ticketId}. Saved ${saved.length} Request records.`);
  return saved;
}


exports.createRequest = async (req, res) => {
  try {
    const ticket = req.body;
    const data = await Request.create(ticket);
    // console.log({data});

    res.json(data);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Server error" });
  }
}
