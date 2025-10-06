const fetch = require('node-fetch'); 

// helpers
function safeGet(obj, pathArr) {
  if (!obj) return undefined;
  let cur = obj;
  for (const p of pathArr) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function normalizePhone(phone) {
  if (!phone) return "";
  const s = String(phone).trim();
  const digits = s.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  // fallback to the provided string
  return s;
}

function formatUSDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => n.toString().padStart(2, "0");
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${hours}:${minutes}:${seconds} ${ampm}`;
}

// deterministic transform (fallback)
function transformToSasFlex(input) {
  // Names
  const firstName =
    safeGet(input, ["customer", "firstName"]) ||
    safeGet(input, ["customer", "name"]) ||
    safeGet(input, ["variables", "customer", "firstName"]) ||
    safeGet(input, ["FirstName"]) || "";
  const lastName =
    safeGet(input, ["customer", "lastName"]) ||
    safeGet(input, ["variables", "customer", "lastName"]) ||
    safeGet(input, ["LastName"]) || "";

  // Address attempt
  let street = "";
  let city = "";
  let state = "";
  let zipcode = "";

  // Try validatePolicy tool result (many payloads embed tool outputs in artifact.messages)
  const artifactMessages = safeGet(input, ["artifact", "messages"]) || safeGet(input, ["messages"]) || [];
  const validateMsg = artifactMessages.find((m) => (m && (m.name === "validatePolicy" || (m.name || "").toLowerCase().includes("validatepolicy")))) || safeGet(input, ["validatePolicy"]) || null;
  let validateParsed = null;
  if (validateMsg) {
    if (typeof validateMsg === "object" && validateMsg.result) {
      try {
        validateParsed = typeof validateMsg.result === "string" ? JSON.parse(validateMsg.result) : validateMsg.result;
      } catch (e) {
        // ignore parse errors
      }
    } else if (typeof validateMsg === "object" && validateMsg.policyData) {
      validateParsed = validateMsg;
    } else if (typeof validateMsg === "object" && validateMsg.policyData) {
      validateParsed = validateMsg.policyData;
    }
  }
  if (validateParsed && validateParsed.policyData) {
    const pd = validateParsed.policyData;
    street = pd.address || pd.risk_address_line_1 || street;
    city = pd.risk_address_city || city;
    state = pd.risk_address_state || state;
    zipcode = pd.risk_address_zip_code || zipcode;
  }

  // reverse geocode tool
  const reverseGeoMsg = artifactMessages.find((m) => m && (m.name === "getReverseGeocode" || (m.name || "").toLowerCase().includes("reversegeocode")));
  if ((!street || !city) && reverseGeoMsg && reverseGeoMsg.result) {
    try {
      const parsed = typeof reverseGeoMsg.result === "string" ? JSON.parse(reverseGeoMsg.result) : reverseGeoMsg.result;
      if (parsed?.geoCodeResponse) {
        street = parsed.geoCodeResponse.formatted_address || street;
        const comps = parsed.geoCodeResponse.address_components || [];
        city = city || (comps.find((c) => (c.types || []).includes("locality")) || {}).long_name || city;
        state = state || (comps.find((c) => (c.types || []).some((t) => t.includes("administrative_area_level_1"))) || {}).short_name || state;
        zipcode = zipcode || (comps.find((c) => (c.types || []).includes("postal_code")) || {}).long_name || zipcode;
      }
    } catch (e) {
      // ignore
    }
  }

  // phones
  const mainPhone = normalizePhone(
    safeGet(input, ["phoneNumber", "number"]) ||
    safeGet(input, ["number"]) ||
    safeGet(input, ["customer", "number"]) ||
    safeGet(input, ["callerId"]) ||
    safeGet(input, ["customer", "phone"]) ||
    "N/A"
  );
  const callerId = normalizePhone(safeGet(input, ["customer", "number"]) || safeGet(input, ["caller", "id"]) || "N/A");

  // DNIS heuristics
  const dnis = safeGet(input, ["number"]) || safeGet(input, ["Activity", "number"]) || safeGet(input, ["phoneNumber", "number"]) || "N/A";

  // Greeting from transcript
  let greeting = "";
  const transcript = safeGet(input, ["artifact", "transcript"]) || safeGet(input, ["transcript"]) || "N/A";
  if (typeof transcript === "string") {
    const m = transcript.match(/AI:\s*([^\n]+)/);
    if (m) greeting = m[1].trim();
  }
  greeting = greeting || (safeGet(input, ["messages", 0, "message"]) || "N/A");

  // Session start date
  const startedAt = safeGet(input, ["startedAt"]) || safeGet(input, ["Activity", "recorded_time"]) || safeGet(input, ["createdAt"]) || safeGet(input, ["artifact", "createdAt"]) || "N/A";
  const sessionStartDate = formatUSDate(startedAt);

  // Policy number: try validateParsed then transcript
  let policyNumber = "";
  if (validateParsed && validateParsed.policyData && validateParsed.policyData.policy_number) {
    policyNumber = validateParsed.policyData.policy_number;
  } else {
    // search transcript
    if (typeof transcript === "string") {
      const m1 = transcript.match(/policy (?:number|no|#)\s*(?:is|:)?\s*([A-Za-z0-9\-]+)/i);
      const m2 = transcript.match(/\b(PA[0-9A-Za-z\-]+)\b/i);
      policyNumber = (m1 && m1[1]) || (m2 && m2[1]) || "";
    }
  }

  // PA or OH
  let paOrOh = "";
  if (state) {
    if (/^PA$/i.test(state)) paOrOh = "Pennsylvania";
    if (/^OH$/i.test(state)) paOrOh = "Ohio";
  } else if (/^PA/i.test(policyNumber)) {
    paOrOh = "Pennsylvania";
  }

  // Policy holder heuristic
  let policyHolder = "";
  const insuredFirst = safeGet(validateParsed, ["policyData", "insured_first_name"]) || safeGet(validateParsed, ["policyData", "insuredName"]) || "N/A";
  const insuredLast = safeGet(validateParsed, ["policyData", "insured_last_name"]) || "N/A";
  if (insuredFirst || insuredLast) {
    policyHolder = `${insuredFirst} ${insuredLast}`.trim();
  } else if (typeof transcript === "string" && /on behalf/i.test(transcript)) {
    policyHolder = "No - Calling On Behalf Of Policy Holder";
  } else {
    policyHolder = "Yes";
  }

  // Roadside service from transcript keywords
  let roadsideService = "";
  if (typeof transcript === "string") {
    if (/lockout/i.test(transcript)) roadsideService = "Lockout";
    if (/tow|towed/i.test(transcript)) roadsideService = roadsideService || "Tow";
    if (/brake/i.test(transcript) || /repair/i.test(transcript)) roadsideService = roadsideService || "Repair";
  }

  // Vehicle
  let manufacturerrandyear = "";
  const vehicles = safeGet(validateParsed, ["policyData", "vehicles"]) || safeGet(validateParsed, ["vehicles"]) || [];
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    const v = vehicles[0];
    const year = v.vehicle_model_year || v.vehicle_year || v.year || "N/A";
    const make = v.vehicle_manufacturer || v.vehicle_make || v.make || "N/A";
    const model = v.vehicle_model_model || v.vehicle_model || v.model || "N/A";
    manufacturerrandyear = [year, make, model].filter(Boolean).join(" ").trim();
  } else if (typeof transcript === "string") {
    const vm = transcript.match(/(\b20\d{2}\b)\s+([A-Za-z0-9]+)/);
    if (vm) manufacturerrandyear = `${vm[1]} ${vm[2]}`;
  }

  // Existing ticket attempt
  let existingTicket = "No";
  const ticketCreatorMsg = artifactMessages.find((m) => m && (m.name === "ticketCreator" || (m.name || "").toLowerCase().includes("ticketcreator")));
  if (ticketCreatorMsg && ticketCreatorMsg.result) {
    try {
      const parsed = typeof ticketCreatorMsg.result === "string" ? JSON.parse(ticketCreatorMsg.result) : ticketCreatorMsg.result;
      if (parsed?.ticket?.ticketId || parsed?.ticketId) existingTicket = "Yes";
    } catch (e) {
      // ignore parse error
    }
  }

  // system details
  const agentId = safeGet(input, ["assistantOverrides", "agentId"]) || safeGet(input, ["Agent ID"]) || "N/A";
  const agentName = safeGet(input, ["assistantOverrides", "agentName"]) || safeGet(input, ["agent", "name"]) || "N/A";
  const scriptName = safeGet(input, ["assistantOverrides", "scriptName"]) || safeGet(input, ["scriptName"]) || "N/A";
  const callOutcome = safeGet(input, ["analysis", "summary"]) || safeGet(input, ["endedReason"]) || safeGet(input, ["status"]) || "N/A";

  return {
    subject: "New Service Assignment - Roadside Assistance",
    title: "New SAS Flex Message",
    tableData: {
      "First Name": firstName || "N/A",
      "Last Name": lastName || "N/A",
      "Street Address": street || "N/A",
      "City": city || "N/A",
      "State": state || "N/A",
      "Zip Code": zipcode || "N/A",
      "Main Phone": mainPhone || "N/A",
      "Cell Phone": "N/A", // unknown
      "Agent Notes": "N/A",
      "Ticket Message": "N/A",
      "DNIS": dnis || "N/A",
      "Greeting": greeting || "N/A",
      "Session Start Date": sessionStartDate || "N/A",
      "Workflow Path": safeGet(input, ["workflow", "path"]) || safeGet(input, ["workflowPath"]) || "N/A",
      "Policy Number": policyNumber || "N/A",
      "PA or OH": paOrOh || "N/A",
      "Policy Holder": policyHolder || "N/A",
      "RoadsideService": roadsideService || "N/A",
      "manufacturerrandyear": manufacturerrandyear || "N/A",
      "Existing Ticket": existingTicket || "No"
    },
    systemDetails: {
      "Agent ID": agentId || "N/A",
      "Agent Name": agentName || "N/A",
      "Script Name": scriptName || "N/A",
      "Caller ID": callerId || mainPhone || "N/A",
      "Call Outcome": callOutcome || "N/A"
    }
  };
}

// Gemini prompt builder
function buildGeminiPromptsForExtraction(rawJsonStr) {
  const systemPrompt = `
You are a strict JSON extraction assistant. Input: a single JSON object that contains call, activity, tool results and other metadata.
Your job: produce a single JSON object exactly matching the provided output schema (see USER PROMPT).
Output nothing else — only the JSON. Use the first matching source when multiple candidate fields exist. If a field cannot be found, set it to an empty string "".
Dates must be US formatted "M/D/YYYY h:mm:ss A" (e.g. 9/2/2025 8:39:45 PM).
Phones should be normalized to common format "(XXX) XXX-XXXX" or left as original if unparseable.
Agent/system details should be derived from assistantOverrides, variables, or top-level metadata if present.
  `.trim();

  const userPrompt = `
INPUT_JSON:
${rawJsonStr}

OUTPUT_SCHEMA:
{
  "subject": "New Service Assignment - Roadside Assistance",
  "title": "New SAS Flex Message",
  "tableData": {
    "First Name": "",
    "Last Name": "",
    "Street Address": "",
    "City": "",
    "State": "",
    "Zip Code": "",
    "Main Phone": "",
    "Cell Phone": "",
    "Agent Notes": "",
    "Ticket Message": "",
    "DNIS": "",
    "Greeting": "",
    "Session Start Date": "",
    "Workflow Path": "",
    "Policy Number": "",
    "PA or OH": "",
    "Policy Holder": "",
    "RoadsideService": "",
    "manufacturerrandyear": "",
    "Existing Ticket": ""
  },
  "systemDetails": {
    "Agent ID": "",
    "Agent Name": "",
    "Script Name": "",
    "Caller ID": "",
    "Call Outcome": ""
  }
}

INSTRUCTIONS:
1. Parse INPUT_JSON and fill every field inside OUTPUT_SCHEMA.
2. Output only the JSON that matches OUTPUT_SCHEMA (no commentary, no extra fields).
3. Use heuristics: check top-level fields, nested fields like "activity", "artifact", "analysis", "assistantOverrides", "validatePolicy" results, and the "transcript".
4. Normalize phone formats where possible. For Policy Number prefer things from tool results (validatePolicy or ticketCreator) else transcript.
5. For "manufacturerrandyear" combine vehicle year + manufacturer + model from any vehicle object present.
6. For "Session Start Date", use the call startedAt or Activity.recorded_time and format as described.
7. If user explicitly mentions "on behalf of", set "Policy Holder" accordingly; otherwise use policyData insured name if present.
`.trim();

  return { systemPrompt, userPrompt };
}

// output validation
function validateOutputSchema(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.subject || !obj.title || !obj.tableData || !obj.systemDetails) return false;
  const keys = [
    "First Name","Last Name","Street Address","City","State","Zip Code","Main Phone","Cell Phone",
    "Agent Notes","Ticket Message","DNIS","Greeting","Session Start Date","Workflow Path","Policy Number",
    "PA or OH","Policy Holder","RoadsideService","manufacturerrandyear","Existing Ticket"
  ];
  for (const k of keys) if (!(k in obj.tableData)) return false;
  const sysKeys = ["Agent ID","Agent Name","Script Name","Caller ID","Call Outcome"];
  for (const k of sysKeys) if (!(k in obj.systemDetails)) return false;
  return true;
}

// Gemini call
async function callGeminiGenerativeApi(apiKey, model, systemPrompt, userPrompt, timeoutMs = 60000) {
  if (!apiKey) throw new Error("GEMINI_API_KEY not provided");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }]
  };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(id);

    const respText = await resp.text();

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error(`Gemini API returned ${resp.status} ${resp.statusText}`);
      console.error("Response body:", respText, resp);
      throw new Error(`Gemini API error ${resp.status}: ${t}`);
    }

    const data = await resp.json();

    // Extract textual reply robustly
    let candidateTexts = [];

    // v1beta2 'candidates' shape
    if (Array.isArray(data.candidates)) {
      for (const c of data.candidates) {
        if (typeof c.output === "string") candidateTexts.push(c.output);
        if (Array.isArray(c.content)) {
          for (const chunk of c.content) if (chunk?.text) candidateTexts.push(chunk.text);
        }
      }
    }

    // 'outputs' shape
    if (Array.isArray(data.outputs)) {
      for (const out of data.outputs) {
        if (typeof out?.content === "string") candidateTexts.push(out.content);
        if (Array.isArray(out?.content)) {
          for (const chunk of out.content) if (chunk?.text) candidateTexts.push(chunk.text);
        }
        if (typeof out?.text === "string") candidateTexts.push(out.text);
      }
    }

    // fallback: stringify whole response
    if (candidateTexts.length === 0) candidateTexts.push(JSON.stringify(data, null, 2));

    // return the first non-empty candidate
    return candidateTexts.find(Boolean) || candidateTexts[0];
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Main function to call from your code.
 * @param {Object} jsonData - dynamic JSON object
 * @param {Object} options - { useGemini: boolean, geminiModel: string, geminiTimeoutMs: number }
 * @returns structured object matching formatted data schema
 */
async function llmFunction(jsonData) {
  const useGemini = true;
  const model = "gemini-2.5-flash";
  const timeoutMs = 15000;
  const geminiKey = process.env.GEMINI_API_KEY;

  // quick safety: ensure jsonData is an object
  if (!jsonData || typeof jsonData !== "object") {
    throw new Error("jsonData must be an object");
  }

  // If user wants Gemini and API key present, try LLM route
  if (useGemini && geminiKey) {
    try {
      const rawJsonStr = JSON.stringify(jsonData, null, 2);
      const { systemPrompt, userPrompt } = buildGeminiPromptsForExtraction(rawJsonStr);
      const rawResponse = await callGeminiGenerativeApi(geminiKey, model, systemPrompt, userPrompt, timeoutMs);

      // Clean common wrappers and extract JSON substring
      let text = (rawResponse || "").trim();
      if (!text) throw new Error("Empty Gemini response");

      // strip triple backticks if present
      if (text.startsWith("```")) {
        text = text.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/\n?```$/, "");
      }

      // find first { ... } block
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        text = text.slice(first, last + 1);
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // If parsing fails, attempt to extract JSON-like substring by braces counting
        let start = text.indexOf("{");
        if (start !== -1) {
          let depth = 0;
          let end = -1;
          for (let i = start; i < text.length; i++) {
            if (text[i] === "{") depth++;
            if (text[i] === "}") {
              depth--;
              if (depth === 0) { end = i; break; }
            }
          }
          if (end !== -1) {
            const substring = text.slice(start, end + 1);
            parsed = JSON.parse(substring);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      if (validateOutputSchema(parsed)) {
        return parsed;
      } else {
        // if LLM result doesn't validate, fall back to deterministic transform
        const fallback = transformToSasFlex(jsonData);
        return fallback;
      }
    } catch (err) {
      console.error("Gemini error — falling back to deterministic transform:", err instanceof Error ? err.message : String(err));
      return transformToSasFlex(jsonData);
    }
  }

  return transformToSasFlex(jsonData);
}

module.exports = { llmFunction, transformToSasFlex };


