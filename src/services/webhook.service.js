const {
  SystemStatus,
  AIConfig,
  Organization,
  User,
  AICallActivity,
} = require("../models");
const {
  conciergeAIModel: insuranceAIModel,
} = require("../utils/prompts/insurance.prompt");
const {
  analyzeTranscriptAndCreateHubSpotRecords,
} = require("./transcript-analyzer.service");
const { genAI } = require("../config/google");
const { clientCustomPromptService } = require("./clientCustomPrompt.service");

/**
 * Webhook Service for handling VAPI webhook requests
 */
class WebhookService {
  /**
   * Generate assistant configuration for inbound calls
   * @param {Object} clientData - Client data
   * @param {string} assistantId - Assistant ID
   * @param {Object} event - VAPI event
   * @returns {Object} Assistant configuration
   */
  async generateInboundAssistantConfig(clientData, assistantId, event) {
    // Get custom prompt for concierge type
    let customPrompt;
    let aiModel;
    let firstMessageMode =
      "assistant-speaks-first-with-model-generated-message";
    let firstMessage = "Hello ";

    try {
      // Extract organization ID from clientData
      const organizationId =
        clientData?.organizationId || clientData?.organization_id;
      if (organizationId) {
        customPrompt =
          await clientCustomPromptService.findByOrganizationIdAndType(
            organizationId,
            "concierge"
          );
        console.log(customPrompt);
        // Process tools and add booking appointment metadata if needed
        if (customPrompt?.tools) {
          const callTransferTool = customPrompt.tools.find(
            (tool) => tool.name === "calltransfer"
          );
          clientData.aiConfig = callTransferTool
            ? {
                metadata: {
                  ...callTransferTool.metadata,
                  organizationId: organizationId,
                },
              }
            : customPrompt.tools[0];
        } else {
          const callTransferTool = clientData.tools.find(
            (tool) => tool.name === "calltransfer"
          );
          clientData.aiConfig = callTransferTool
            ? {
                metadata: {
                  ...callTransferTool.metadata,
                  organizationId: organizationId,
                },
              }
            : clientData.tools[0];
        }
      }
    } catch (error) {
      console.log(`⚠️ Error fetching custom concierge prompt:`, error.message);
    }

    if (customPrompt && customPrompt.prompt) {
      console.log(`✅ Using custom concierge prompt`);

      // If custom prompt is a function (default prompt), call it with parameters
      if (typeof customPrompt.prompt === "function") {
        aiModel = customPrompt.prompt({ clientData });
      } else {
        // Use custom prompt as-is (string or object)
        aiModel = insuranceAIModel({ clientData }, customPrompt.prompt);
      }

      // Add call initiation settings based on type
      switch (customPrompt.callInitiationType) {
        case "ai-initiates":
          firstMessageMode = "assistant-speaks-first";
          break;
        case "human-initiates":
          firstMessageMode = "assistant-waits-for-user";
          break;
        case "ai-initiates-static":
          firstMessageMode = "assistant-speaks-first";
          if (customPrompt.staticMessage) {
            firstMessage = customPrompt.staticMessage;
          }
          break;
      }
    } else {
      // Fallback to default prompt
      console.log(`📝 Using default concierge prompt`);
      aiModel = insuranceAIModel({ clientData });
    }

    const config = {
      messageResponse: {
        assistantId,
        assistantOverrides: {
          firstMessageInterruptionsEnabled: true,
          firstMessageMode: firstMessageMode,
          firstMessage,
          endCallFunctionEnabled: true,
          backgroundDenoisingEnabled: true,
          endCallMessage: "Thanks for having me",
          transcriber: {
            provider: "deepgram",
          },
          model: aiModel,
          silenceTimeoutSeconds: 30,
          messagePlan: {
            idleMessages: [
              "Are you Still there?",
              "Is there anything else you need help with?",
              "How can i help you further?",
              "Is there something specific you are looking for?",
              "Feel free to ask me any further questions",
              "I'm ready to help whenever you are",
              "I'm still here if you need assistant",
            ],
            idleMessageResetCountOnUserSpeechEnabled: true,
            idleTimeoutSeconds: 7.5,
            silenceTimeoutMessage:
              "Sorry, seems i lost you, can you try calling back?, bye for now.",
            idleMessageMaxSpokenCount: 3,
          },
          voice: {
            provider: "deepgram",
            voiceId: "hera",
            model: "aura-2",
          },
        },
      },
    };

    // Add custom first message if available
    if (customPrompt && customPrompt.staticMessage) {
      config.messageResponse.assistantOverrides.firstMessage =
        customPrompt.staticMessage;
    }

    return config;
  }

  /**
   * Generate service unavailable response
   * @param {string} [message] - Custom message
   * @returns {Object} Response object
   */
  generateUnavailableResponse(
    message = "Sorry, this service is currently unavailable"
  ) {
    return {
      success: false,
      data: {
        assistant: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: message,
          maxDurationSeconds: 10.0,
          endCallFunctionEnabled: true,
          model: {
            provider: "openai",
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "end the call immediately.",
              },
            ],
          },
        },
      },
    };
  }

  /**
   * Generate feature disabled response
   * @returns {Object} Response object
   */
  generateFeatureDisabledResponse() {
    return {
      success: false,
      data: {
        assistant: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage:
            "Sorry, This call feature is not activated from your end",
          maxDurationSeconds: 10.0,
          endCallFunctionEnabled: true,
          model: {
            provider: "openai",
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "end the call immediately.",
              },
            ],
          },
        },
      },
    };
  }

  /**
   * Generate error response
   * @param {string} [message] - Error message
   * @returns {Object} Response object
   */
  generateErrorResponse(
    message = "We're experiencing technical difficulties. Please try again later."
  ) {
    return {
      success: false,
      data: {
        assistant: {
          firstMessageMode: "assistant-speaks-first",
          firstMessage: message,
          maxDurationSeconds: 10.0,
          endCallFunctionEnabled: true,
          model: {
            provider: "openai",
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "end the call immediately.",
              },
            ],
          },
        },
      },
    };
  }

  /**
   * Get required data for webhook processing
   * @param {string} phoneNumber - Phone number
   * @param {string} sid - System ID
   * @returns {Promise<Object>} Required data
   */
  async getRequiredData(phoneNumber, sid) {
    try {
      const [systemStatus, aiConfig] = await Promise.all([
        SystemStatus.findOne({ _id: sid }),
        AIConfig.findOne(
          { number: phoneNumber }
          // { client_id: 1, assistant_id: 1 }
        ),
      ]);

      if (!aiConfig) {
        return { systemStatus, aiConfig: null };
      }

      // Get client data from Organization and User models
      const clientUserId = aiConfig.client_id?.[0]?.toString();

      const [user, organization] = await Promise.all([
        User.findById(clientUserId),
        Organization.findOne({ owner: clientUserId }),
      ]);

      // Structure the client data to match expected format
      const clientData = {
        servicesRequested: {
          aIAgentActiveCalls: organization?.inboundAi || false,
          outboundAi: organization?.outboundAi || false,
        },
        companyDetails: {
          companyName: organization?.companyName || "24Hr Truck Services",
          companyWebsite: organization?.companyWebsite,
          companyAddress: organization?.companyAddress,
          businessEntityType: organization?.businessEntityType,
          organizationType: organization?.organization_type,
        },
        userDetails: {
          firstName: user?.firstname,
          lastName: user?.lastname,
          email: user?.email,
          phoneNumber: user?.phoneNumber,
        },
        tools: organization?.tools || [],
      };

      return { systemStatus, aiConfig, clientData };
    } catch (error) {
      console.error("Error fetching webhook data:", error);
      throw error;
    }
  }

  /**
   * Process outbound webhook request
   * @param {Object} vapiEvent - VAPI event data
   * @param {string} phoneNumber - Phone number
   * @param {string} sid - System ID
   * @returns {Promise<Object>} Processing result
   */
  async processOutboundWebhook(vapiEvent, phoneNumber, sid) {
    try {
      console.log("Processing outbound webhook:", {
        eventType: vapiEvent?.message?.type,
        phoneNumber,
        sid,
      });

      switch (vapiEvent?.message?.type) {
        case "status-update":
          // Handle status updates (just acknowledge)
          console.log(
            "Received outbound status update:",
            vapiEvent?.message?.status
          );
          return {
            success: true,
            data: { status: "ok" },
          };

        default:
          console.error(
            "Unsupported outbound message type:",
            vapiEvent?.message?.type
          );
          return this.generateErrorResponse("Unsupported message type");
      }
    } catch (error) {
      console.error("Error in outbound webhook processing:", error);
      return this.generateErrorResponse();
    }
  }

  /**
   * Process inbound webhook request
   * @param {Object} vapiEvent - VAPI event data
   * @param {string} phoneNumber - Phone number
   * @param {string} sid - System ID
   * @returns {Promise<Object>} Processing result
   */
  async processInboundWebhook(vapiEvent, phoneNumber, sid) {
    try {
      switch (vapiEvent?.message?.type) {
        case "assistant-request":
          // Validate required parameters
          if (!phoneNumber || !sid) {
            return this.generateErrorResponse("Invalid request parameters");
          }

          // Fetch all required data with timeout
          const data = await Promise.race([
            this.getRequiredData(phoneNumber, sid),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Data fetch timeout")), 5000)
            ),
          ]);

          // Check system status
          if (!data.systemStatus?.active) {
            return this.generateUnavailableResponse();
          }

          // Check AI config
          if (!data.aiConfig) {
            return this.generateErrorResponse(
              "No AI config found for this number"
            );
          }

          // Check client data
          if (!data.clientData) {
            return this.generateErrorResponse("Failed to fetch client data");
          }

          // Check feature activation
          if (!data.clientData?.servicesRequested?.aIAgentActiveCalls) {
            return this.generateFeatureDisabledResponse();
          }

          // Create activity log using AICallActivity model
          try {
            console.log("Creating inbound call activity");
            await AICallActivity.create({
              call_id: vapiEvent?.message?.call?.id,
              organization_id: data.aiConfig.organization_id,
              call_type: "inbound",
              number: phoneNumber,
              recorded_time: new Date(),
            });
          } catch (error) {
            console.error("Error creating AI call activity:", error);
            // Don't fail the webhook if activity creation fails
          }
          // console.log(
          //   "vapiResponse",
          //   JSON.stringify(
          //     await this.generateInboundAssistantConfig(
          //       {
          //         ...data.clientData,
          //         organization_id: data.aiConfig.organization_id,
          //       },
          //       data.aiConfig.inbound_assistant_id,
          //       vapiEvent
          //     ),
          //     null,
          //     2
          //   )
          // );
          return {
            success: true,
            data: await this.generateInboundAssistantConfig(
              {
                ...data.clientData,
                aiConfig: data.aiConfig,
                organization_id: data.aiConfig.organization_id,
              },
              data.aiConfig.inbound_assistant_id,
              vapiEvent
            ),
          };

        case "status-update":
          // Handle status updates (just acknowledge)
          console.log(
            "Received inbound status update:",
            vapiEvent?.message?.status
          );
          return {
            success: true,
            data: { status: "ok" },
          };

        default:
          console.error(
            "Unsupported inbound message type:",
            vapiEvent?.message?.type
          );
          return this.generateErrorResponse("Unsupported message type");
      }
    } catch (error) {
      console.error("Error in inbound webhook processing:", error);
      return this.generateErrorResponse();
    }
  }

  /**
   * Process marketing webhook request
   * @param {Object} vapiEvent - VAPI event data
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object>} Processing result
   */
  async processMarketingWebhook(vapiEvent, phoneNumber) {
    try {
      switch (vapiEvent?.message?.type) {
        case "assistant-request":
          // Validate required parameters
          if (!phoneNumber) {
            return this.generateErrorResponse("Invalid request parameters");
          }

          const aiConfig = await AIConfig.findOne({
            "markerting_agents.phone_number": phoneNumber,
          });

          // Check AI config
          if (!aiConfig) {
            return this.generateErrorResponse(
              "No AI config found for this number"
            );
          }

          // Create activity log using AICallActivity model
          try {
            console.log("Creating inbound call activity");
            await AICallActivity.create({
              call_id: vapiEvent?.message?.call?.id,
              organization_id: aiConfig.organization_id,
              call_type: "inbound",
              number: phoneNumber,
              recorded_time: new Date(),
            });
          } catch (error) {
            console.error("Error creating AI call activity:", error);
            // Don't fail the webhook if activity creation fails
          }

          return {
            success: true,
            data: this.generateMarketingAssistantConfig(
              aiConfig,
              aiConfig.markerting_agents.inbound,
              vapiEvent
            ),
          };

        case "status-update":
          // Handle status updates (just acknowledge)
          console.log(
            "Received inbound status update:",
            vapiEvent?.message?.status
          );
          return {
            success: true,
            data: { status: "ok" },
          };

        default:
          console.error(
            "Unsupported inbound message type:",
            vapiEvent?.message?.type
          );
          return this.generateErrorResponse("Unsupported message type");
      }
    } catch (error) {
      console.error("Error in inbound webhook processing:", error);
      return this.generateErrorResponse();
    }
  }

  async processEndofCallReport(vapiEvent) {
    try {
      // Validate required parameters
      if (!vapiEvent) {
        return;
      }

      if (vapiEvent?.message?.type === "end-of-call-report") {
        // Process end-of-call report
        console.log(
          "Processing end-of-call report:",
          JSON.stringify(vapiEvent.message.analysis, null, 2)
        );
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          // generationConfig: {
          //   responseMimeType: "js"
          // }
        });

        analyzeTranscriptAndCreateHubSpotRecords(
          vapiEvent?.message?.summary,
          model,
          vapiEvent?.message?.call?.id,
          vapiEvent?.message?.analysis?.structuredData
        )
          .then(() => {
            console.log("End-of-call report processed successfully");
          })
          .catch((error) => {
            console.error("Error processing end-of-call report:", error);
          });
        console.log("Processing end-of-call report:", vapiEvent);
      }
    } catch (error) {
      console.error("Error in end of call report processing:", error);
    }
  }
}

module.exports = new WebhookService();
