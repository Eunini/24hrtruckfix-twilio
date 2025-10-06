const webhookService = require("../services/webhook.service");
const { HTTP_STATUS_CODES } = require("../helper");
const { AIConfig, AICallActivity, Organization } = require("../models");
const Mechanic = require("../models/mechanic.model");
const aiConfigService = require("../services/aiConfig.service");
const axios = require("axios");
const ticketService = require("../services/ticket.service");
const { googleMeetingService } = require("../services/google.service");
const {
  dispatchCallSystemPrompt,
} = require("../utils/prompts/outbound_prompt");
const {
  clientCustomPromptService,
} = require("../services/clientCustomPrompt.service");

/**
 * Webhook Controllers for VAPI integration
 */
class WebhookController {
  /**
   * Handle inbound webhook requests
   * @route POST /api/v1/inbound-hook
   */
  async handleInboundHook(req, res) {
    try {
      console.log("📞 Inbound webhook received");

      // Parse the VAPI event from request body
      const vapiEvent = req.body;
      const phoneNumber = vapiEvent?.message?.phoneNumber?.number;
      const sid = process.env.MONGODB_STATUS_ID;

      if (vapiEvent?.message?.type === "assistant-request") {
        console.log("Inbound webhook details:", {
          eventType: vapiEvent?.message?.type,
          phoneNumber,
          sid,
          callId: vapiEvent?.message?.call?.id,
        });
      }

      // Process the webhook
      const result = await webhookService.processInboundWebhook(
        vapiEvent,
        phoneNumber,
        sid
      );

      if (result.success) {
        // For VAPI compatibility, return the data directly
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      } else {
        // For errors, still return 200 but with the error response structure for VAPI
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      }
    } catch (error) {
      console.error("❌ Inbound webhook error:", error);

      // Return VAPI-compatible error response
      const errorResponse = webhookService.generateErrorResponse(
        "Internal server error occurred"
      );

      res.status(HTTP_STATUS_CODES.OK).json(errorResponse.data);
    }
  }

  /**
   * Handle outbound webhook requests
   * @route POST /api/v1/outbound-hook
   */
  async handleOutboundHook(req, res) {
    try {
      console.log("📞 Outbound webhook received");

      // Parse the VAPI event from request body
      const vapiEvent = req.body;
      console.log({ vapiEvent });
      const phoneNumber = vapiEvent?.message?.phoneNumber?.number;
      const sid = process.env.MONGODB_STATUS_ID;
      const agentOutput = vapiEvent?.message?.functionCall?.output;
      if (!agentOutput) {
        console.log("No agent decision found, ignoring...");
      } else {
        const { ticket_id, sp_id, services, total_cost, eta } = agentOutput;
        const createMechanicRequest = await ticketService.createRequestService({
          mechanic_id: sp_id,
          ticket_id,
          services,
          eta,
          total_cost,
          notes,
        });

        console.log({ agentOutput, createMechanicRequest });
      }

      console.log("Outbound webhook details:", {
        eventType: vapiEvent?.message?.type,
        phoneNumber,
        sid,
        callId: vapiEvent?.message?.call?.id,
      });

      // Process the webhook
      const result = await webhookService.processOutboundWebhook(
        vapiEvent,
        phoneNumber,
        sid
      );

      if (result.success) {
        // For VAPI compatibility, return the data directly
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      } else {
        // For errors, still return 200 but with the error response structure for VAPI
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      }
    } catch (error) {
      console.error("❌ Outbound webhook error:", error);

      // Return VAPI-compatible error response
      const errorResponse = webhookService.generateErrorResponse(
        "Internal server error occurred"
      );

      res.status(HTTP_STATUS_CODES.OK).json(errorResponse.data);
    }
  }

  /**
   * Handle call mechanics webhook (legacy endpoint)
   * @route POST /api/v1/call-mechanics
   */
  async handleCallMechanicsHook(req, res) {
    try {
      console.log("🔧 Call mechanics webhook received (routing to outbound)");

      // This is the same as outbound webhook - just a different route name
      await this.handleOutboundHook(req, res);
    } catch (error) {
      console.error("❌ Call mechanics webhook error:", error);

      // Return VAPI-compatible error response
      const errorResponse = webhookService.generateErrorResponse(
        "Internal server error occurred"
      );

      res.status(HTTP_STATUS_CODES.OK).json(errorResponse.data);
    }
  }

  /**
   * Health check endpoint for webhooks
   * @route GET /api/v1/webhook/health
   */
  async healthCheck(req, res) {
    try {
      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Webhook service is healthy",
        timestamp: new Date().toISOString(),
        endpoints: {
          inbound: "/api/v1/inbound-hook",
          outbound: "/api/v1/outbound-hook",
          callMechanics: "/api/v1/call-mechanics",
        },
      });
    } catch (error) {
      console.error("❌ Webhook health check error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Webhook service health check failed",
        error: error.message,
      });
    }
  }

  async createWebCall(req, res) {
    try {
      const { mechanicId, organizationId, isOrg = false } = req.query;

      if (!mechanicId && !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Mechanic ID or Organization ID is required",
        });
      }

      let agentId;

      if (isOrg === "true" || isOrg === true) {
        // Handle organization web call
        if (!organizationId) {
          return res.status(400).json({
            success: false,
            message: "Organization ID is required for organization calls",
          });
        }

        const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
          organizationId
        );
        if (!aiConfig) {
          return res.status(404).json({
            success: false,
            message: "Organization not found",
          });
        }

        agentId = aiConfig.markerting_agents.web;
      } else {
        // Handle mechanic web call
        if (!mechanicId) {
          return res.status(400).json({
            success: false,
            message: "Mechanic ID is required for mechanic calls",
          });
        }

        const mechanic = await Mechanic.findById(mechanicId).select(
          "web_agent_id"
        );

        if (!mechanic) {
          return res.status(404).json({
            success: false,
            message: "Mechanic not found",
          });
        }

        if (!mechanic.web_agent_id) {
          return res.status(404).json({
            success: false,
            message: "Web agent not found for this mechanic",
          });
        }

        agentId = mechanic.web_agent_id;
      }

      if (!agentId) {
        return res.status(404).json({
          success: false,
          message: "Web agent not found",
        });
      }

      res.status(200).json({
        agentId,
        type: isOrg ? "organization" : "mechanic",
      });
    } catch (error) {
      console.error("Error creating web call:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create call",
      });
    }
  }

  async createOutboundCall(req, res) {
    try {
      const { orgId, phoneNumber } = req.body;
      let fromNumber;

      let assistantId;
      if (!phoneNumber || !orgId) {
        return res.status(400).json({
          success: false,
          message: "phone number and org/mech id are required",
        });
      }

      try {
        const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
          orgId
        );
        if (aiConfig && aiConfig.number) {
          fromNumber = aiConfig.vapi_phone_number_id;
          assistantId = aiConfig.outbound_assistant_id;
        }
      } catch (err) {
        console.warn(
          "aiConfig lookup failed, falling back to env agent number",
          err
        );
      }

      if (!fromNumber) {
        return res.status(400).json({
          success: false,
          message: "No agent number available",
        });
      }

      const VAPI_BASE_URL = "https://api.vapi.ai";
      const VAPI_API_KEY = process.env.VAPI_API_KEY;
      const SERVER_URL = process.env.SERVER_URL;

      if (!VAPI_BASE_URL || !VAPI_API_KEY || !SERVER_URL) {
        return res.status(500).json({
          success: false,
          message:
            "VAPI_BASE_URL, VAPI_API_KEY and SERVER_URL must be configured in env",
        });
      }

      // Build minimal call payload
      const body = {
        assistantId,
        customer: { number: phoneNumber },
        phoneNumberId: fromNumber,
        metadata: {
          organizationId: orgId,
        },
      };

      // Initiate call
      const resp = await fetch(`${VAPI_BASE_URL}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (err) {
        json = { rawText: text };
      }

      if (!resp.ok) {
        return res.status(resp.status || 500).json({
          success: false,
          message:
            json?.message ||
            json?.error ||
            `VAPI returned status ${resp.status}`,
          raw: json,
        });
      }

      // persist call activity if model exists
      try {
        if (typeof AICallActivity !== "undefined") {
          await AICallActivity.create({
            call_id: json?.id || null,
            organization_id: orgId,
            call_type: "outbound",
            number: phoneNumber,
            recorded_time: new Date(),
          });
        }
      } catch (err) {
        console.warn("Failed to save AICallActivity:", err);
      }

      return res.status(200).json({
        success: true,
        message: "Call initiated",
        data: {
          callId: json?.id || null,
          raw: json,
          from: fromNumber,
          to: phoneNumber,
          assistantId,
          organizationId: orgId,
        },
      });
    } catch (error) {
      console.error("Error initiating agent call:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create agent call",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create demo outbound call following cronJob logic
   * @route POST /api/v1/webhook/demo-outbound-call
   */
  async createDemoOutboundCall(req, res) {
    try {
      const { orgId, phoneNumber, companyName } = req.body;

      if (!phoneNumber || !orgId) {
        return res.status(400).json({
          success: false,
          message: "phone number and org id are required",
        });
      }

      // Demo ticket data structure
      const demoTicket = {
        _id: "68c85fb4a7a12277085f7d86",
        organization_id: orgId,
        breakdown_address: {
          street: "123 Main Street",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
        },
        vehicle_color: "Blue",
        vehicle_year: "2020",
        vehicle_make: "Ford",
        vehicle_model: "F-150",
        cell_country_code: {
          dialCode: phoneNumber.substring(0, phoneNumber.length - 10),
        }, // Extract country code from full number
        current_cell_number: phoneNumber.slice(-10), // Get last 10 digits as main number
        breakdown_reason: [{ label: "Engine trouble", key: "engine" }],
        breakdown_reason_text: "Engine making strange noises and losing power",
        tow_destination: null, // Set to null for repair, or add address for tow
      };

      // Demo mechanic data structure
      const demoMechanic = {
        _id: "demo_mechanic_456",
        displayName: { text: companyName || "John Smith Automotive" },
        formattedAddress: "456 Service Road, Brooklyn, NY 11201",
        internationalPhoneNumber: phoneNumber,
      };

      // Get AI config for the organization
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(orgId);
      if (!aiConfig || !aiConfig.number) {
        return res.status(400).json({
          success: false,
          message: "No AI config or phone number found for organization",
        });
      }

      // Format breakdown address
      const breakdownAddress = `${demoTicket.breakdown_address.street}, ${demoTicket.breakdown_address.city}, ${demoTicket.breakdown_address.state} ${demoTicket.breakdown_address.zipCode}`;

      // Mock distance calculation (in real scenario this would use Google Distance Matrix API)
      const formattedDistance = "2.5 miles";

      // Get organization data
      const organization = await Organization.findById(orgId);
      if (!organization) {
        return res.status(400).json({
          success: false,
          message: "Organization not found",
        });
      }

      // Prepare breakdown reasons
      const primaryReason = demoTicket.breakdown_reason
        ? demoTicket.breakdown_reason.map((r) => r.label || r.key).join(", ")
        : "mechanical breakdown";
      const secondaryReason = demoTicket.breakdown_reason_text || "";

      // Format tow destination if exists
      const towDestination = demoTicket.tow_destination
        ? `${demoTicket.tow_destination.street}, ${demoTicket.tow_destination.city}, ${demoTicket.tow_destination.state}`
        : null;

      // Get custom prompt for dispatch type
      let customPrompt;
      let firstMessage = `Hello am I unto ${demoMechanic.displayName.text}`;

      try {
        customPrompt =
          await clientCustomPromptService.findByOrganizationIdAndType(
            orgId,
            "dispatch"
          );
      } catch (error) {
        console.log(
          `⚠️ Error fetching custom prompt for demo ticket:`,
          error.message
        );
      }

      let systemPrompt;

      if (customPrompt && customPrompt.prompt) {
        // Use custom prompt
        console.log(`✅ Using custom dispatch prompt for demo ticket`);
        systemPrompt = customPrompt.prompt;

        // Use custom first message if available
        if (customPrompt.staticMessage) {
          firstMessage = customPrompt.staticMessage;
        }
      } else {
        // Fallback to default prompt
        console.log(`📝 Using default dispatch prompt for demo ticket`);
        const companyName = organization.companyName || "24Hr Truck Services";
        const vehicleInfo = `${demoTicket.vehicle_color} ${demoTicket.vehicle_year} ${demoTicket.vehicle_make} ${demoTicket.vehicle_model}`;
        const ownerNumber = `${demoTicket.cell_country_code?.dialCode || "+1"}${
          demoTicket.current_cell_number
        }`;
        const distance = formattedDistance;
        const ticketType = towDestination ? "tow" : "repair";

        systemPrompt = dispatchCallSystemPrompt({
          companyName,
          vehicleInfo,
          ownerNumber,
          distance,
          ticketType,
          primaryReason,
          secondaryReason,
          breakdownAddress,
          towDestination,
          displayName: demoMechanic.displayName,
          ticket: demoTicket,
          ticketId: demoTicket._id,
          companyType: organization.organization_type || "fleet",
          miles: formattedDistance,
          address: demoMechanic.formattedAddress,
        });
      }

      // Create VAPI call payload following cronJob structure
      const callPayload = {
        assistant: {
          model: {
            model: "gpt-4o",
            systemPrompt: systemPrompt,
            temperature: 0.7,
            provider: "openai",
            tools: [
              {
                type: "function",
                async: false,
                function: {
                  name: "createJobRequest",
                  description:
                    "This is used to create a job request after taking all the needed information from the user.",
                  parameters: {
                    type: "object",
                    properties: {
                      eta: {
                        type: "string",
                        description: "Estimated time of arrival",
                      },
                      services: {
                        type: "array",
                        description:
                          "An array of all the services to be provided by the service provider",
                        items: {
                          type: "string",
                          description: "The name of the service",
                        },
                      },
                      total_cost: {
                        type: "string",
                        description:
                          "A median of the cost Total range that was given by the Service Provider during the call. Pass it as a number or float",
                      },
                    },
                    required: ["eta", "services", "total_cost"],
                  },
                },
                server: {
                  //https://503e992ebe3a.ngrok-free.app/
                  url:
                    `https://sp-24hr-server.onrender.com/api/v1/request/create/ai?` +
                    `apiKey=${encodeURIComponent(
                      process.env.SETUP_VAPI_API_KEY
                    )}` +
                    `&mechanic=${encodeURIComponent(
                      demoMechanic.internationalPhoneNumber
                    )}` +
                    `&name=${encodeURIComponent(
                      demoMechanic.displayName.text
                    )}` +
                    `&ticket_id=${encodeURIComponent(demoTicket._id)}`,
                },
              },
            ],
          },
          endCallFunctionEnabled: true,
          firstMessage: firstMessage,
        },
        phoneNumber: {
          twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
          twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
          twilioPhoneNumber: aiConfig.number,
        },
        assistantId: aiConfig.assistant_id,
        customer: {
          name: demoMechanic.displayName.text,
          number: phoneNumber,
        },
      };

      // Make VAPI call
      console.log(
        `📞 Making demo VAPI call to ${demoMechanic.displayName.text}`
      );
      const callResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer 9a8d1c07-e26f-4106-8958-3b4c71b5c90f",
        },
        body: JSON.stringify(callPayload),
      });

      const callResponseText = await callResponse.text();
      let callResponseJson;
      try {
        callResponseJson = callResponseText ? JSON.parse(callResponseText) : {};
      } catch (err) {
        callResponseJson = { rawText: callResponseText };
      }

      if (callResponse.ok) {
        console.log(
          `✅ Demo call initiated successfully for ${demoMechanic.displayName.text}`
        );

        // Save call activity
        try {
          await AICallActivity.create({
            call_id: callResponseJson?.id || null,
            organization_id: orgId,
            call_type: "outbound",
            number: phoneNumber,
            recorded_time: new Date(),
          });
        } catch (err) {
          console.warn("Failed to save demo AICallActivity:", err);
        }

        return res.status(200).json({
          success: true,
          message: "Demo call initiated successfully",
          data: {
            callId: callResponseJson?.id || null,
            demoTicket: {
              id: demoTicket._id,
              vehicleInfo: `${demoTicket.vehicle_color} ${demoTicket.vehicle_year} ${demoTicket.vehicle_make} ${demoTicket.vehicle_model}`,
              breakdownAddress,
              primaryReason,
              secondaryReason,
            },
            demoMechanic: {
              name: demoMechanic.displayName.text,
              address: demoMechanic.formattedAddress,
              phone: phoneNumber,
            },
            distance: formattedDistance,
            organizationId: orgId,
            raw: callResponseJson,
          },
        });
      } else {
        console.error(`❌ Failed to initiate demo call:`, callResponseText);
        return res.status(callResponse.status || 500).json({
          success: false,
          message:
            callResponseJson?.message ||
            callResponseJson?.error ||
            `VAPI returned status ${callResponse.status}`,
          raw: callResponseJson,
        });
      }
    } catch (error) {
      console.error("Error creating demo outbound call:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create demo outbound call",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async handleMarketingHook(req, res) {
    try {
      console.log("📞 Marketing webhook received");

      // Parse the VAPI event from request body
      const vapiEvent = req.body;
      const phoneNumber = vapiEvent?.message?.phoneNumber?.number;

      if (vapiEvent?.message?.type === "assistant-request") {
        console.log("Marketing webhook details:", {
          eventType: vapiEvent?.message?.type,
          phoneNumber,
          callId: vapiEvent?.message?.call?.id,
        });
      }

      // Process the webhook
      const result = await webhookService.processMarketingWebhook(
        vapiEvent,
        phoneNumber
      );

      if (result.success) {
        // For VAPI compatibility, return the data directly
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      } else {
        // For errors, still return 200 but with the error response structure for VAPI
        res.status(HTTP_STATUS_CODES.OK).json(result.data);
      }
    } catch (error) {
      console.error("❌ Inbound webhook error:", error);

      // Return VAPI-compatible error response
      const errorResponse = webhookService.generateErrorResponse(
        "Internal server error occurred"
      );

      res.status(HTTP_STATUS_CODES.OK).json(errorResponse.data);
    }
  }

  async handleMarketingOutboundHook(req, res) {
    try {
      console.log("📞 Marketing outbound webhook received");

      const vapiEvent = req.body;
      const phoneNumber = vapiEvent?.message?.phoneNumber?.number;
      const orgId = vapiEvent?.message?.call?.metadata?.org_id;
      const callId = vapiEvent?.message?.call?.id;
      console.log("Marketing outbound webhook details:", {
        phoneNumber,
        orgId,
        callId,
      });
      // create ai call activity
      const aiCallActivity = new AICallActivity({
        call_id: callId,
        organization_id: orgId,
        call_type: "outbound",
        number: phoneNumber,
        recorded_time: new Date(),
      });

      aiCallActivity.save().catch((error) => {
        console.error("Error creating ai call activity:", error);
      });

      res.status(200).json({
        success: true,
        message: "AI call activity created",
      });
    } catch (error) {
      console.error("❌ Marketing outbound webhook error:", error);
    }
  }

  async handleMarketingWebCallHook(req, res) {
    try {
      console.log("📞 Marketing web call webhook received");
      const vapiEvent = req.body;
      const orgId = vapiEvent?.message?.call?.metadata?.org_id;
      const callId = vapiEvent?.message?.call?.id;

      webhookService.processEndofCallReport(vapiEvent);

      // create ai call activity
      const aiConfig = await AIConfig.findOne({
        "markerting_agents.web": req.body.message.assistant.id,
      }).select("organization_id");

      const verifyIfCallExists = await AICallActivity.findOne({
        call_id: callId,
      });

      if (verifyIfCallExists) {
        return res.status(200).json({
          success: true,
          message: "AI call activity already exists",
        });
      }

      const aiCallActivity = new AICallActivity({
        call_id: callId,
        organization_id: aiConfig.organization_id,
        call_type: "web-call",
        number: "web-call",
        recorded_time: new Date(),
      });

      aiCallActivity.save().catch((error) => {
        console.error("Error creating ai call activity:", error);
      });

      res.status(200).json({
        success: true,
        message: "AI call activity created",
      });
    } catch (error) {
      console.error("❌ Marketing webhook error:", error);
    }
  }

  /**
   * Handle knowledge base chat webhook requests
   * @route POST /api/v1/webhook/knowledge-base/chat
   */
  async handleKnowledgeBaseChat(req, res) {
    try {
      console.log("📚 Knowledge Base Chat webhook received");

      // Parse the VAPI event from request body
      const { organizationId } = req.params;
      const vapiEvent = req.body;
      const toolCalls = vapiEvent?.message?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        // Handle VAPI function calls
        const toolCall = toolCalls[0];
        const tool_id = toolCall.id;
        const functionCall = toolCall.function;
        const parameters = functionCall.arguments;
        const message = parameters.message;

        console.log("🔍 VAPI Knowledge Base Chat Request:", {
          toolId: tool_id,
          message: message,
        });

        if (!message) {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Message is required",
                  response: null,
                }),
              },
            ],
          });
        }

        // Make API call to external knowledge base service
        try {
          const response = await axios.post(
            "https://knowledge-base-tool.onrender.com/api/v1/kb/search",
            {
              query: message,
              includeMetadata: false,
              metadata: {
                organizationId: organizationId,
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000, // 60 second timeout
            }
          );

          console.log("✅ Knowledge base API response:", response.data);

          // Return VAPI-compatible success response
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: true,
                  message: "Knowledge base query processed successfully",
                  response: response.data,
                }),
              },
            ],
          });
        } catch (apiError) {
          console.error(
            "❌ Knowledge base API error:",
            apiError.response?.data || apiError.message
          );

          // Return VAPI-compatible error response
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Failed to get response from knowledge base",
                  error: apiError.response?.data?.message || apiError.message,
                  response: null,
                }),
              },
            ],
          });
        }
      } else {
        // Handle direct API calls (non-VAPI) - fallback to original logic
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }

        // Make API call to external knowledge base service
        try {
          const response = await axios.post(
            "https://knowledge-base-tool.onrender.com/api/v1/kb/search",
            {
              query: message,
              includeMetadata: false,
              metadata: {
                organizationId: organizationId,
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000, // 60 second timeout
            }
          );

          console.log("✅ Knowledge base API response:", response.data);

          // Return direct API response
          res.json({
            success: true,
            message: "Knowledge base query processed successfully",
            response: response.data,
          });
        } catch (apiError) {
          console.error(
            "❌ Knowledge base API error:",
            apiError.response?.data || apiError.message
          );

          res.status(500).json({
            success: false,
            message: "Failed to get response from knowledge base",
            error: apiError.response?.data?.message || apiError.message,
          });
        }
      }
    } catch (error) {
      console.error("❌ Knowledge Base Chat webhook error:", error);

      // Return VAPI-compatible error response
      return res.status(200).json({
        results: [
          {
            toolCallId: "unknown",
            result: JSON.stringify({
              success: false,
              message:
                "An error occurred while processing the knowledge base chat",
              error: error.message,
              response: null,
            }),
          },
        ],
      });
    }
  }

  /**
   * Handle knowledge base chat webhook requests
   * @route POST /api/v1/webhook/knowledge-base/chat
   */
  async handleBookingAppointment(req, res) {
    try {
      console.log("📚 Booking Appointment webhook received");

      // Parse the VAPI event from request body
      const { organizationId } = req.params;
      const vapiEvent = req.body;
      const toolCalls = vapiEvent?.message?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        // Handle VAPI function calls
        const toolCall = toolCalls[0];
        const tool_id = toolCall.id;
        const functionCall = toolCall.function;
        const parameters = functionCall.arguments;

        console.log("🔍 VAPI Booking Appointment Request:", {
          toolId: tool_id,
          parameters: parameters,
        });

        if (!parameters) {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Parameters are required",
                  response: null,
                }),
              },
            ],
          });
        }

        if (!parameters.email || parameters.email.trim() === "") {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Email is required, ask the user for their email",
                  response: null,
                }),
              },
            ],
          });
        }
        if (!parameters.timeZoneId || parameters.timeZoneId.trim() === "") {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message:
                    "timeZoneId is required, ask the user for their time zone",
                  response: null,
                }),
              },
            ],
          });
        }

        // confirm that the organization exist
        const organization = await Organization.findById(organizationId).select(
          "calendar_connection"
        );

        console.log("🔍 Organization found:", organization);

        if (!organization) {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Organization not found",
                  response: null,
                }),
              },
            ],
          });
        }

        if (
          !organization.calendar_connection ||
          !organization.calendar_connection.provider ||
          !organization.calendar_connection.connectionRefreshToken
        ) {
          return res.status(200).json({
            results: [
              {
                toolCallId: tool_id,
                result: JSON.stringify({
                  success: false,
                  message: "Organization does not have a calendar connected",
                  response: null,
                }),
              },
            ],
          });
        }

        const result = await googleMeetingService({
          action: "BOOK_MEETING",
          calendarInput: {
            ...parameters,
            refresh_token:
              organization.calendar_connection.connectionRefreshToken,
            calendarId:
              organization.calendar_connection?.calendarId ?? "default",
          },
          organizationId: organizationId,
          callId: tool_id,
        });

        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: result.status === 200,
                message: result,
                response: null,
              }),
            },
          ],
        });
      } else {
        // Handle direct API calls (non-VAPI) - fallback to original logic
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }

        // Make API call to external knowledge base service
        try {
          const response = await axios.post(
            "https://knowledge-base-tool.onrender.com/api/v1/kb/search",
            {
              query: message,
              includeMetadata: false,
              metadata: {
                organizationId: organizationId,
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000, // 60 second timeout
            }
          );

          console.log("✅ Knowledge base API response:", response.data);

          // Return direct API response
          res.json({
            success: true,
            message: "Knowledge base query processed successfully",
            response: response.data,
          });
        } catch (apiError) {
          console.error(
            "❌ Knowledge base API error:",
            apiError.response?.data || apiError.message
          );

          res.status(500).json({
            success: false,
            message: "Failed to get response from knowledge base",
            error: apiError.response?.data?.message || apiError.message,
          });
        }
      }
    } catch (error) {
      console.error("❌ Booking Appointment webhook error:", error);

      // Return VAPI-compatible error response
      return res.status(200).json({
        results: [
          {
            toolCallId: "unknown",
            result: JSON.stringify({
              success: false,
              message:
                "An error occurred while processing the knowledge base chat",
              error: error.message,
              response: null,
            }),
          },
        ],
      });
    }
  }
}

module.exports = new WebhookController();
