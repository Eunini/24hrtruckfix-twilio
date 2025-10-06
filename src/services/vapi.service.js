const axios = require("axios");
const { generateAssistantPrompt } = require("../utils/prompts");
const { multilingualExtension } = require("../utils/prompts/general");
const env = require("../config");
const { llmFunction } = require("./ai/geminiEmail");
const { sendSASFlexEmail } = require("./mail/aiactivitymail");
const { Organization, Mechanic, User, Role } = require('../models');


/**
 * VAPI Service for managing AI assistants and phone numbers
 */
class VapiService {
  constructor() {
    this.baseURL = "https://api.vapi.ai";
    this.apiKey = process.env.VAPI_API_KEY;

    if (!this.apiKey) {
      throw new Error("VAPI_API_KEY environment variable is required");
    }
  }

  /**
   * Build standard Knowledge Base tool definition
   */
  buildKnowledgeBaseTool(targetId) {
    return {
      type: "function",
      async: false,
      messages: [
        { type: "request-start", content: "Searching our knowledge base..." },
        {
          type: "request-response-delayed",
          content: "Just a moment while I find the information...",
          timingMilliseconds: 3000,
        },
      ],
      function: {
        name: "knowledge_base_chat",
        description:
          "Search the organization's knowledge base for relevant information to help answer questions.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description:
                "The question or query to search for in the knowledge base",
            },
          },
          required: ["message"],
        },
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/webhook/knowledge-base/${targetId}/chat`,
      },
    };
  }

  /**
   * Build Appointment Booking tool for a specific target (mechanic/org)
   */
  buildAppointmentBookingTool(targetId, options = {}) {
    const { query = "", isMarketing = false } = options;
    const queryString = isMarketing ? "?type=marketing" : query;
    const serverUrl = isMarketing
      ? env.serverUrl
      : env.tools.appointmentBooking.url;
    return {
      type: "function",
      async: false,
      messages: [
        { type: "request-start", content: "Booking your appointment..." },
        {
          type: "request-response-delayed",
          content:
            "Just a moment while I schedule your appointment with the mechanic...",
          timingMilliseconds: 2000,
        },
      ],
      function: {
        name: "Appointment_BookingTool",
        description: "Book an appointment with the mechanic",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Title or summary of the meeting or event",
            },
            description: {
              type: "string",
              description: "Detailed description of the meeting or event",
            },
            startTime: {
              type: "string",
              description: "ISO 8601 formatted start time of the appointment",
            },
            timeZoneId: {
              type: "string",
              description: "Time zone identifier (e.g., 'America/New_York')",
            },
            email: {
              type: "string",
              description: "Email address of the attendee",
            },
          },
          required: ["email", "summary", "startTime", "timeZoneId"],
        },
      },
      server: {
        url: `${serverUrl}/api/v1/calendar/action/${targetId}${queryString}`,
      },
    };
  }

  /**
   * Build Email Collection tool for marketing web agents
   */
  buildEmailCollectionTool() {
    return {
      type: "function",
      async: true,
      messages: [
        { type: "request-start", content: "Please provide your email..." },
        {
          type: "request-response-delayed",
          content: "Just a moment while I save your information...",
          timingMilliseconds: 1500,
        },
      ],
      function: {
        name: "email_collection_tool",
        description:
          "This is used to take the email of the user while on the call with them",
        parameters: {
          type: "object",
          properties: {
            open: {
              type: "boolean",
              description:
                "this is set to true when the email collection tool is open",
            },
          },
        },
      },
    };
  }

  /**
   * Build tools for a mechanic web agent
   */
  buildMechanicWebTools(mechanicId) {
    return [
      this.buildEndCallTool(),
      this.buildAppointmentBookingTool(mechanicId),
      this.buildKnowledgeBaseTool(mechanicId),
    ];
  }

  /**
   * Build tools for marketing inbound/outbound agents
   */
  buildMarketingVoiceTools(orgId) {
    return [
      this.buildEndCallTool(),
      this.buildEmailCollectionTool(),
      this.buildAppointmentBookingTool(orgId, { isMarketing: true }),
      this.buildKnowledgeBaseTool(orgId),
    ];
  }

  buildEndCallTool() {
    return {
      type: "endCall",
    };
  }

  /**
   * Check if organization has active calendar connection
   * @param {String} targetId - Organization or mechanic ID
   * @param {Object} options - Additional options
   * @returns {Boolean} True if has active calendar connection
   */
  async hasActiveCalendarConnection(targetId, options = {}) {
    try {
      let organizationId = targetId;
      
      // If targetId is a mechanic ID, get the organization ID
      if (options.isMarketing === false) {
        const mechanic = await Mechanic.findById(targetId);
        if (mechanic) {
          organizationId = mechanic.organizationId;
        }
      }
      
      // Check organization's calendar connection
      const organization = await Organization.findById(organizationId);
      return organization && 
             organization.calendar_connection && 
             organization.calendar_connection.id_token;
    } catch (error) {
      console.error('Error checking calendar connection:', error);
      return false;
    }
  }

  /**
   * Build tools for organization using default prompt
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Additional options for tool building
   * @returns {Array} Array of built tools
   */
  async buildToolsForOrganization(organizationId, options = {}) {
    try {
      const organization = await Organization.findById(organizationId);
      
      if (!organization || !organization.tools || organization.tools.length === 0) {
        // Return default tools if no custom tools configured
        return [
          this.buildEndCallTool(),
          this.buildKnowledgeBaseTool(organizationId)
        ];
      }
      
      // Build tools based on organization configuration
      return await this.buildToolsFromConfig(organization.tools, organizationId, { ...options, isMarketing: true });
    } catch (error) {
      console.error('Error building tools for organization:', error);
      // Return default tools on error
      return [
        this.buildEndCallTool(),
        this.buildKnowledgeBaseTool(organizationId)
      ];
    }
  }

  /**
   * Build tools array based on tools configuration
   * @param {Array} toolsConfig - Array of tool objects with name and optional metadata
   * @param {string} targetId - Target ID (mechanic or organization)
   * @param {Object} options - Additional options for tool building
   * @returns {Array} Array of built tools
   */
  async buildToolsFromConfig(toolsConfig, targetId, options = {}) {
    const tools = [];
    
    for (const toolConfig of toolsConfig) {
      const { name, metadata = {} } = toolConfig;
      
      switch (name.toLowerCase()) {
        case 'endcall':
          tools.push(this.buildEndCallTool());
          break;
        case 'bookappointment':
          // Only add booking tool if organization has active calendar connection
          const hasCalendar = await this.hasActiveCalendarConnection(targetId, options);
          if (hasCalendar) {
            tools.push(this.buildAppointmentBookingTool(targetId, { ...options, ...metadata }));
          } else {
            console.warn(`Skipping bookappointment tool for ${targetId}: No active calendar connection`);
          }
          break;
        case 'knowledgebase':
          tools.push(this.buildKnowledgeBaseTool(targetId));
          break;
        case 'emailcollection':
          tools.push(this.buildEmailCollectionTool());
          break;
        case 'calltransfer':
          tools.push(this.buildCallTransferTool(metadata));
          break;
        default:
          console.warn(`Unknown tool type: ${name}`);
      }
    }
    
    return tools;
  }

  /**
   * Build Call Transfer tool
   * @param {Object} metadata - Tool metadata containing transfer configuration
   * @returns {Object} Call transfer tool configuration
   */
  buildCallTransferTool(metadata = {}) {
    return {
      type: "transferCall",
      function: {
        name: "transfer_call_tool",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      messages: [
        {
          type: "request-start",
          blocking: false
        }
      ],
      destinations: [
        {
          type: "number",
          number: metadata.transferNumber || "+1234567890",
          message: metadata.transferMessage || "hey",
          transferPlan: {
            mode: "warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary",
            sipVerb: "refer",
            timeout: 5,
            summaryPlan: {
              enabled: true,
              messages: [
                {
                  role: "system",
                  content: metadata.summaryContent || "Please provide a summary of the call to the receiving agent."
                },
                {
                  role: "user",
                  content: ""
                }
              ],
              timeoutSeconds: 5,
              useAssistantLlm: true
            }
          },
          numberE164CheckEnabled: true
        }
      ]
    };
  }

  /**
   * Build analysis plan for marketing agents
   */
  buildMarketingAnalysisPlan() {
    return {
      analysisPlan: {
        structuredDataPlan: {
          enabled: true,
          schema: {
            type: "object",
            required: [
              "email",
              "number",
              "firstName",
              "subject ",
              "body",
              "priority",
              "dueDate",
            ],
            properties: {
              body: {
                description:
                  "this is a meaninig ful body detail; that can be used as a task based on the call context",
                type: "string",
              },
              email: {
                description: "the email of the user you jusdt spoke with ",
                type: "string",
              },
              number: {
                description: "the number of the user you jusdt spoke with ",
                type: "string",
              },
              company: {
                description:
                  "The name of the company that the user belonged to ",
                type: "string",
              },
              dueDate: {
                description:
                  "Set a reasonable due date (within next 7 days or lower based on the flow of the call)",
                type: "string",
              },
              lastName: {
                description: "the first name of the user you jusdt spoke with ",
                type: "string",
              },
              priority: {
                type: "string",
                enum: ["HIGH", "MEDIUM", "LOW"],
              },
              subject: {
                description:
                  "this is a meaninig ful title detail; that can be used as a task based on the call context",
                type: "string",
              },
              firstName: {
                description: "the first name of the user you jusdt spoke with ",
                type: "string",
              },
            },
          },
          messages: [
            {
              content:
                '    You are an AI assistant tasked with extracting customer and task information from call transcripts for CRM purposes.\n    \n    Extract the following information from the transcript and format it as a JSON object:\n    \n    For customer data:\n    - Extract email, firstName, lastName, phone, company if mentioned\n    - If information is not available, use null\n    \n    For task data:\n    - Create a relevant follow-up task based on the conversation\n    - Set appropriate priority (HIGH, MEDIUM, LOW)\n    - Set a reasonable due date (within next 7 days)\n    - Set status to "NOT_STARTED"\n    - Create meaningful subject and body based on conversation context\n\nJson Schema:\n{{schema}}\n\nOnly respond with the JSON.',
              role: "system",
            },
            {
              content:
                "Here is the transcript:\n\n{{transcript}}\n\n. Here is the ended reason of the call:\n\n{{endedReason}}\n\n",
              role: "user",
            },
          ],
        },
      },
    };
  }

  /**
   * Build tools for marketing web agents
   */
  buildMarketingWebTools(orgId) {
    return [
      this.buildEndCallTool(),
      this.buildEmailCollectionTool(),
      this.buildAppointmentBookingTool(orgId, { isMarketing: true }),
      this.buildKnowledgeBaseTool(orgId),
    ];
  }

  /**
   * Get default headers for VAPI requests
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a VAPI assistant
   * @param {Object} assistantConfig - Assistant configuration
   * @returns {Promise<Object>} Created assistant data
   */
  async createAssistant(assistantConfig) {
    try {
      assistantConfig.model.messages[0].content =
        assistantConfig.model.messages[0].content + multilingualExtension;

      const response = await axios.post(
        `${this.baseURL}/assistant`,
        assistantConfig,
        { headers: this.getHeaders() }
      );

      console.log(
        `✅ VAPI assistant created: ${assistantConfig.name} (ID: ${response.data.id})`
      );
      return response.data;
    } catch (error) {
      console.error(
        "❌ VAPI assistant creation failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to create VAPI assistant: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Create an inbound assistant for an organization
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Created assistant data
   */
  async createInboundAssistant(orgName, orgId) {
    const assistantConfig = {
      name: `${orgName} inbound`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
[Identity]
Your name is Ava. You work for ${orgName} - 24-Hr Rescue Service

[Your Task]
Help drivers with broken down vehicles by collecting information to dispatch mechanics.

[Conversation Flow]
1. Greet the driver warmly and ask about their vehicle issue
2. Get vehicle details (color, year, make, model, license plate)
3. Ask if they want towing or on-site repair
4. Collect their current location or ask them to share GPS location
5. Get their contact information for updates
6. Confirm help is on the way and provide estimated arrival time
7. Offer to stay on the line if they feel unsafe

[Tone]
- Professional but friendly and reassuring
- Empathetic to their stressful situation
- Clear and concise instructions
- Patient with elderly or stressed callers

[Important Notes]
- Always prioritize safety - if they're in danger, advise calling 911 first
- Get accurate location information - this is critical for dispatch
- Confirm all details before ending the call
- Provide your company contact number for follow-up
          `,
          },
        ],
        tools: await this.buildToolsForOrganization(orgId),
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/inbound-hook`,
      },
      metadata: {
        org_id: orgId,
        type: "inbound",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Create an outbound assistant for an organization
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Created assistant data
   */
  async createOutboundAssistant(orgName, orgId) {
    const assistantConfig = {
      name: `${orgName} outbound`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
[Identity]
Your name is Alex. You work for ${orgName} - 24-Hr Rescue Service

[Your Task]
Contact mechanics to dispatch them for vehicle breakdown calls.

[Conversation Flow]
1. Greet the mechanic professionally
2. Explain you have a breakdown call that needs service
3. Provide job details: location, vehicle type, issue description
4. Ask about their availability and estimated arrival time
5. Confirm their acceptance and provide job reference number
6. Give them the customer contact information
7. Confirm they have the location and any special instructions

[Tone]
- Professional and business-like
- Clear and efficient communication
- Respectful of their time
- Provide all necessary details upfront

[Important Information to Collect]
- Availability confirmation (yes/no)
- Estimated arrival time
- Any questions about the job
- Confirmation they have customer contact info

[Job Details to Provide]
- Customer location (address and GPS coordinates)
- Vehicle details (make, model, year, color)
- Problem description
- Customer contact number
- Job reference number
- Special instructions or access codes
          `,
          },
        ],
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/outbound-hook`,
      },
      metadata: {
        org_id: orgId,
        type: "outbound",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Create a web agent for a mechanic
   * @param {string} mechanicName - Mechanic name/business name
   * @param {string} mechanicId - Mechanic ID
   * @returns {Promise<Object>} Created assistant data
   */
  async createWebAgent(
    mechanicName,
    mechanicId,
    specialty,
    serviceCapabilities,
    OtherServices
  ) {
    const assistantConfig = {
      name: `${mechanicName} web agent`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: generateAssistantPrompt(
              mechanicName,
              specialty,
              serviceCapabilities?.join(", ") + OtherServices
            ),
          },
        ],
        tools: this.buildMechanicWebTools(mechanicId),
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/web-hook`,
      },
      metadata: {
        mechanic_id: mechanicId,
        type: "web",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Register a phone number with VAPI
   * @param {string} phoneNumber - Phone number to register
   * @param {string} assistantId - Assistant ID to associate with the number
   * @param {string} orgName - Organization name for naming
   * @param {string} type - Type of assistant (inbound/outbound)
   * @returns {Promise<Object>} Registered phone number data
   */
  async registerPhoneNumber(
    phoneNumber,
    assistantId,
    orgName,
    type = "inbound"
  ) {
    try {
      const phoneNumberConfig = {
        provider: "twilio",
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
        assistantId,
        name: `${orgName}-${type}-${assistantId.slice(-8)}`,
        serverUrl: `${process.env.SERVER_URL}/api/v1/${type}-hook`,
        number: phoneNumber,
      };

      const response = await axios.post(
        `${this.baseURL}/phone-number`,
        phoneNumberConfig,
        { headers: this.getHeaders() }
      );

      console.log(
        `✅ VAPI phone number registered: ${phoneNumber} for ${orgName} ${type}`
      );
      return response.data;
    } catch (error) {
      console.error(
        "❌ VAPI phone number registration failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to register phone number with VAPI: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Delete an assistant
   * @param {string} assistantId - Assistant ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAssistant(assistantId) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/assistant/${assistantId}`,
        { headers: this.getHeaders() }
      );

      console.log(`✅ VAPI assistant deleted: ${assistantId}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ VAPI assistant deletion failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to delete VAPI assistant: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Delete a phone number
   * @param {string} phoneNumberId - Phone number ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deletePhoneNumber(phoneNumberId) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/phone-number/${phoneNumberId}`,
        { headers: this.getHeaders() }
      );

      console.log(`✅ VAPI phone number deleted: ${phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ VAPI phone number deletion failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to delete VAPI phone number: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Get assistant details
   * @param {string} assistantId - Assistant ID
   * @returns {Promise<Object>} Assistant data
   */
  async getAssistant(assistantId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/assistant/${assistantId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to get VAPI assistant:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to get VAPI assistant: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Update assistant configuration
   * @param {string} assistantId - Assistant ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated assistant data
   */
  async updateAssistant(assistantId, updateData) {
    try {
      // Ensure tools are preserved/added on updates
      if (!updateData?.model?.tools) {
        try {
          const existing = await this.getAssistant(assistantId);
          const existingTools = existing?.model?.tools;
          if (Array.isArray(existingTools) && existingTools.length > 0) {
            updateData.model = updateData.model || {};
            updateData.model.tools = existingTools;
          }
        } catch (innerErr) {
          console.warn(
            "Proceeding without preserving tools; failed to fetch existing assistant:",
            innerErr?.message || innerErr
          );
        }
      }

      const response = await axios.patch(
        `${this.baseURL}/assistant/${assistantId}`,
        updateData,
        { headers: this.getHeaders() }
      );

      console.log(`✅ VAPI assistant updated: ${assistantId}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ VAPI assistant update failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to update VAPI assistant: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Get call details from VAPI
   * @param {string} callId - Call ID to retrieve
   * @returns {Promise<Object>} Call data mapped for frontend
   */
  async getCall(callId) {
    try {
      const response = await axios.get(`${this.baseURL}/call/${callId}`, {
        headers: this.getHeaders(),
      });

      const callData = response.data;

      // Map VAPI response to frontend expected format
      const mappedData = this.mapCallDataForFrontend(callData);

      console.log(`✅ VAPI call retrieved: ${callId}`);
      return mappedData;
    } catch (error) {
      console.error(
        "❌ VAPI call retrieval failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to retrieve VAPI call: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

    /**
   * Get call details from VAPI and send the details as an email
   * @param {string} callId - Call ID to retrieve
   */
  async buildGeminiEmail(callId) {
  try {
    const response = await axios.get(`${this.baseURL}/call/${callId}`, {
      headers: this.getHeaders(),
    });

    const callData = response.data;
    const geminiTemplate = await llmFunction(callData)
    const [adminRole, superAdminRole] = await Promise.all([
      Role.findOne({ name: "admin" }).lean(),
      Role.findOne({ name: "super_admin" }).lean(),
    ]);
    if (!adminRole || !superAdminRole) {
      console.warn("One of the roles (admin/super_admin) was not found");
      return;
    }

    const admins = await User.find({
      role_id: { $in: [adminRole._id, superAdminRole._id] },
    })
      .select("email firstname lastname")
      .lean();

    const service = { email: "service@24hrtruckfix.com", firstname: "Support" };
    const dispatch = { email: "dispatch@24hrtruckfix.com", firstname: "Dispatch" };
    const combined = [ dispatch, service, ...admins];
    const deduped = Object.values(
      combined.reduce((acc, u) => {
        if (u.email) acc[u.email] = u;
        return acc;
      }, {})
    );

    const primary = dispatch.email;
    const bccList = deduped.map((u) => u.email).filter((e) => e !== primary);
    const data = {
      to: primary,
      bccList,
      ...geminiTemplate
    }
    await sendSASFlexEmail(data)
  } catch (error) {
    console.error(
      "❌ Email Template creation failed:",
      error.response?.data || error.message
    );
    throw new Error(
      `Failed to create email: ${
        error.response?.data?.message || error.message
      }`
    );
  }
  }


  /**
   * Create marketing agents for an organization (inbound, outbound, and web)
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Object containing all three created agents
   */
  async createMarketingAgents(orgName, orgId) {
    try {
      console.log(`🚀 Creating marketing agents for ${orgName}...`);

      // Create inbound marketing agent
      const inboundAgent = await this.createMarketingInboundAgent(
        orgName,
        orgId
      );
      console.log(`✅ Inbound marketing agent created: ${inboundAgent.id}`);

      // Create outbound marketing agent
      const outboundAgent = await this.createMarketingOutboundAgent(
        orgName,
        orgId
      );
      console.log(`✅ Outbound marketing agent created: ${outboundAgent.id}`);

      // Create web marketing agent
      const webAgent = await this.createMarketingWebAgent(orgName, orgId);
      console.log(`✅ Web marketing agent created: ${webAgent.id}`);

      const result = {
        inbound: inboundAgent,
        outbound: outboundAgent,
        web: webAgent,
        message: `Successfully created all marketing agents for ${orgName}`,
      };

      console.log(
        `🎉 All marketing agents created successfully for ${orgName}`
      );
      return result;
    } catch (error) {
      console.error(
        `❌ Failed to create marketing agents for ${orgName}:`,
        error.message
      );
      throw new Error(`Failed to create marketing agents: ${error.message}`);
    }
  }

  /**
   * Create a marketing-focused inbound agent
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Created inbound agent data
   */
  async createMarketingInboundAgent(orgName, orgId) {
    const assistantConfig = {
      name: `${orgName} Marketing Inbound`,
      ...this.buildMarketingAnalysisPlan(),
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
[Identity]
Your name is Marketing Ava. You work for ${orgName} - Marketing Department

[Your Task]
Handle inbound marketing inquiries and lead generation calls professionally.

[Conversation Flow]
1. Greet callers warmly and introduce yourself as part of the marketing team
2. Ask how you can help them today
3. Listen to their inquiry and identify their needs
4. Provide information about your products/services
5. Collect lead information (name, email, phone, company, interest level)
6. Offer to send marketing materials or schedule follow-up
7. Thank them for their interest and provide next steps

[Tone]
- Professional, friendly, and enthusiastic
- Knowledgeable about marketing and sales
- Helpful and solution-oriented
- Patient and attentive to customer needs

[Lead Information to Collect]
- Full name
- Email address
- Phone number
- Company name (if business inquiry)
- Specific interest or inquiry type
- Preferred contact method
- Timeline for their needs

[Important Notes]
- Always be professional and represent the company well
- Focus on understanding their needs before pitching
- Offer value and helpful information
- Follow up on promises made during the call
- Document all interactions for the marketing team
          `,
          },
        ],
        tools: this.buildMarketingVoiceTools(orgId),
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/marketing-inbound-hook`,
      },
      metadata: {
        org_id: orgId,
        type: "marketing_inbound",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Create a marketing-focused outbound agent
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Created outbound agent data
   */
  async createMarketingOutboundAgent(orgName, orgId) {
    const assistantConfig = {
      name: `${orgName} Marketing Outbound`,
      ...this.buildMarketingAnalysisPlan(),
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
[Identity]
Your name is Marketing Alex. You work for ${orgName} - Marketing Department

[Your Task]
Make outbound marketing calls to prospects and existing customers for lead generation and relationship building.

[Conversation Flow]
1. Introduce yourself professionally and state your company name
2. Explain the purpose of your call clearly
3. Ask if this is a good time to talk
4. Present your value proposition or offer
5. Listen to their response and address any concerns
6. Collect or update their information
7. Schedule follow-up or next steps
8. Thank them for their time

[Tone]
- Professional and confident
- Respectful of their time
- Enthusiastic about your offerings
- Patient and understanding

[Key Information to Collect/Update]
- Current contact information
- Interest level in your products/services
- Preferred communication method
- Best time to contact them
- Any objections or concerns
- Next steps or follow-up preferences

[Important Guidelines]
- Always ask if it's a good time to talk
- Respect do-not-call requests immediately
- Focus on building relationships, not just selling
- Listen more than you talk
- Be prepared to handle objections professionally
- Document all interactions for follow-up
          `,
          },
        ],
        tools: this.buildMarketingVoiceTools(orgId),
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/marketing-outbound-hook`,
      },
      metadata: {
        org_id: orgId,
        type: "marketing_outbound",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Create a marketing-focused web agent
   * @param {string} orgName - Organization name
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Created web agent data
   */
  async createMarketingWebAgent(orgName, orgId) {
    const assistantConfig = {
      name: `${orgName} Marketing Web Agent`,
      ...this.buildMarketingAnalysisPlan(),
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
[Identity]
Your name is Marketing Web Assistant. You work for ${orgName} - Marketing Department

[Your Task]
Provide marketing support and lead generation assistance through web chat interactions.

[Conversation Flow]
1. Greet visitors warmly and introduce yourself
2. Ask how you can help them today
3. Provide information about products/services
4. Answer questions about pricing, features, or company
5. Collect lead information when appropriate
6. Offer to connect them with sales team
7. Provide helpful resources or next steps

[Tone]
- Professional, friendly, and helpful
- Knowledgeable about marketing and company offerings
- Patient and thorough in explanations
- Enthusiastic about helping visitors

[Information to Provide]
- Product/service details and benefits
- Pricing information and packages
- Company information and credentials
- Customer testimonials and case studies
- Contact information and next steps

[Lead Generation]
- Collect email addresses for newsletters
- Offer free consultations or demos
- Schedule sales calls or meetings
- Provide downloadable resources
- Connect visitors with appropriate team members

[Important Notes]
- Always represent the company professionally
- Focus on providing value and helpful information
- Be responsive and engaging
- Document all interactions for marketing team
- Offer clear next steps for interested visitors
          `,
          },
        ],
        tools: this.buildMarketingWebTools(orgId),
      },
      server: {
        url: `${process.env.SERVER_URL}/api/v1/marketing-web-hook`,
      },
      metadata: {
        org_id: orgId,
        type: "marketing_web",
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah",
      },
    };

    return await this.createAssistant(assistantConfig);
  }

  /**
   * Map VAPI call data to frontend expected format
   * @param {Object} vapiCallData - Raw VAPI call response
   * @returns {Object} Mapped data for frontend
   */
  mapCallDataForFrontend(vapiCallData) {
    // Extract conversation messages and format them
    const conversation = [];
    if (vapiCallData.messages && vapiCallData.messages.length > 0) {
      vapiCallData.messages.forEach((msg) => {
        if (msg.message && msg.role) {
          conversation.push({
            role: msg.role.toUpperCase(), // Convert to uppercase to match frontend
            message: msg.message,
            time: msg.time,
            duration: msg.duration,
          });
        }
      });
    }

    // Extract summary from analysis if available
    let summary = null;
    if (vapiCallData.analysis && vapiCallData.analysis.summary) {
      summary = vapiCallData.analysis.summary;
    }

    // Extract conversation analysis
    let conversationAnalysis = {
      callStatus: "Unknown",
      userSentiment: "Unknown",
      disconnectionReason: null,
    };

    if (vapiCallData.analysis) {
      // Map call status based on VAPI status and endedReason
      if (
        vapiCallData.status === "ended" &&
        !vapiCallData.endedReason?.includes("error")
      ) {
        conversationAnalysis.callStatus = "Successful";
      } else if (vapiCallData.endedReason) {
        conversationAnalysis.callStatus = "Failed";
        conversationAnalysis.disconnectionReason = vapiCallData.endedReason;
      }

      // Extract sentiment if available in structured data
      if (vapiCallData.analysis.structuredData) {
        const structuredData = vapiCallData.analysis.structuredData;
        if (structuredData.sentiment) {
          conversationAnalysis.userSentiment = structuredData.sentiment;
        } else if (structuredData.userSentiment) {
          conversationAnalysis.userSentiment = structuredData.userSentiment;
        }
      }
    }

    // Calculate duration from timestamps or use provided duration
    let duration = null;
    if (vapiCallData.startedAt && vapiCallData.endedAt) {
      const startTime = new Date(vapiCallData.startedAt);
      const endTime = new Date(vapiCallData.endedAt);
      duration = endTime.getTime() - startTime.getTime(); // Duration in milliseconds
    }

    return {
      // Core call information
      id: vapiCallData.id,
      status: vapiCallData.status,
      duration: duration,
      cost: vapiCallData.cost,
      costBreakdown: vapiCallData.costBreakdown,

      // Timestamps
      createdAt: vapiCallData.createdAt,
      startedAt: vapiCallData.startedAt,
      endedAt: vapiCallData.endedAt,

      // Call details
      type: vapiCallData.type,
      phoneCallTransport: vapiCallData.phoneCallTransport,
      endedReason: vapiCallData.endedReason,

      // Customer/destination info
      customer: vapiCallData.customer,
      destination: vapiCallData.destination,

      // Analysis and conversation data mapped for frontend
      conversationAnalysis,
      summary,
      conversation,

      // Assistant information
      assistant: vapiCallData.assistant,
      assistantId: vapiCallData.assistantId,

      // Raw VAPI data for reference
      rawVapiData: vapiCallData,
    };
  }
}

module.exports = new VapiService();
