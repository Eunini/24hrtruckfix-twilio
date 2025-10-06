const mongoose = require("mongoose");
const ClientCustomPrompt = require("../models/clientCustomPrompt.model");
const vapiService = require("./vapi.service");
const { Organization, AIConfig } = require("../models");
const aiConfigService = require("./aiConfig.service");
const outboundPrompt = require("../utils/prompts/outbound_prompt");
const insurancePrompt = require("../utils/prompts/insurance.prompt");
const { multilingualExtension } = require("../utils/prompts/general");
// env not needed here after centralizing tool builders

class ClientCustomPromptService {
  /**
   * Find a client custom prompt by ID
   */
  async findById(promptId) {
    try {
      return await ClientCustomPrompt.findById(promptId);
    } catch (error) {
      console.error("Error finding client custom prompt:", error);
      return null;
    }
  }

  /**
   * Find a client custom prompt by organization ID and prompt type
   */
  async findByOrganizationIdAndType(organizationId, promptType) {
    try {
      return await ClientCustomPrompt.findOne({ organizationId, promptType });
    } catch (error) {
      console.error(
        "Error finding client custom prompt by organization ID and type:",
        error
      );
      return null;
    }
  }

  /**
   * Find all client custom prompts by organization ID
   */
  async findByOrganizationId(organizationId) {
    try {
      return await ClientCustomPrompt.find({ organizationId });
    } catch (error) {
      console.error(
        "Error finding client custom prompts by organization ID:",
        error
      );
      return [];
    }
  }

  /**
   * Create or retrieve a client custom prompt for an organization
   */
  async createOrRetrieve(promptData) {
    try {
      const {
        organizationId,
        prompt,
        callInitiationType,
        staticMessage,
        promptType,
        agentID,
      } = promptData;

      // Get AI configuration for the organization to determine assistant ID
      let resolvedAgentID = agentID;
      if (!agentID && promptType !== "web-chat") {
        // Only dispatch and concierge require specific assistant IDs from AIConfig when custom prompt is provided
        if (
          (promptType === "dispatch" || promptType === "concierge") &&
          prompt
        ) {
          const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
            organizationId
          );

          if (!aiConfig) {
            throw new Error(
              "AI configuration not found for organization. Cannot create prompt without assistant configuration."
            );
          }

          // Determine which assistant ID to use based on prompt type
          if (promptType === "dispatch") {
            resolvedAgentID = aiConfig.outbound_assistant_id;
          } else if (promptType === "concierge") {
            resolvedAgentID = aiConfig.inbound_assistant_id;
          }

          if (!resolvedAgentID) {
            const assistantType =
              promptType === "dispatch" ? "outbound" : "inbound";
            throw new Error(
              `${assistantType} assistant ID not found in AI configuration. Cannot create ${promptType} prompt.`
            );
          }
        } else if (promptType === "dispatch" || promptType === "concierge") {
          // For default prompts, try to get AI config but don't fail if not found
          try {
            const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
              organizationId
            );
            if (aiConfig) {
              if (promptType === "dispatch") {
                resolvedAgentID = aiConfig.outbound_assistant_id;
              } else if (promptType === "concierge") {
                resolvedAgentID = aiConfig.inbound_assistant_id;
              }
            }
          } catch (error) {
            console.log(
              `AI config not found for organization ${organizationId}, using default prompt without assistant ID`
            );
          }

          // If still no agentID, provide a default one for database requirement
          if (!resolvedAgentID) {
            resolvedAgentID =
              promptType === "dispatch"
                ? "default-dispatch-agent"
                : "default-concierge-agent";
          }
        }
        // For other prompt types (inbound-voice, outbound-voice, web-voice),
        // they can create their own agent IDs if not provided
      }

      // Check if prompt already exists for this organization and prompt type
      let clientCustomPrompt = await ClientCustomPrompt.findOne({
        organizationId,
        promptType,
      });

      if (clientCustomPrompt) {
        // Update existing prompt
        clientCustomPrompt.prompt = prompt || clientCustomPrompt.prompt;
        clientCustomPrompt.callInitiationType =
          callInitiationType || clientCustomPrompt.callInitiationType;
        clientCustomPrompt.staticMessage =
          staticMessage || clientCustomPrompt.staticMessage;
        clientCustomPrompt.agentID =
          resolvedAgentID || clientCustomPrompt.agentID;
        clientCustomPrompt.isActive = true;
      } else {
        // Create new prompt with default values or default prompts
        let defaultPromptContent = prompt || "";

        // Use default prompts if no custom prompt provided
        if (!prompt) {
          if (promptType === "dispatch") {
            defaultPromptContent = outboundPrompt.dispatchCallSystemPrompt;
          } else if (promptType === "concierge") {
            defaultPromptContent = insurancePrompt.conciergeAIModel;
          }
        }

        clientCustomPrompt = new ClientCustomPrompt({
          organizationId,
          prompt: defaultPromptContent,
          callInitiationType: callInitiationType || "ai-initiates",
          staticMessage: staticMessage || "",
          promptType,
          agentID: promptType !== "web-chat" ? resolvedAgentID : undefined,
          isActive: true,
        });
      }

      await clientCustomPrompt.save();

      // Update VAPI assistant if organization has one and prompt is for voice
      if (promptType !== "web-chat" && prompt && clientCustomPrompt.agentID) {
        await this.updateVapiAssistant(clientCustomPrompt);
      }

      return clientCustomPrompt;
    } catch (error) {
      console.error("Error creating/retrieving client custom prompt:", error);
      throw error;
    }
  }

  /**
   * Update a client custom prompt
   */
  async update(promptId, updateData) {
    try {
      const clientCustomPrompt = await ClientCustomPrompt.findById(promptId);

      if (!clientCustomPrompt) {
        throw new Error("Client custom prompt not found");
      }

      // Update fields
      if (updateData.prompt !== undefined) {
        clientCustomPrompt.prompt = updateData.prompt;
      }
      if (updateData.callInitiationType !== undefined) {
        clientCustomPrompt.callInitiationType = updateData.callInitiationType;
      }
      if (updateData.staticMessage !== undefined) {
        clientCustomPrompt.staticMessage = updateData.staticMessage;
      }
      if (updateData.isActive !== undefined) {
        clientCustomPrompt.isActive = updateData.isActive;
      }
      if (updateData.agentID !== undefined) {
        clientCustomPrompt.agentID = updateData.agentID;
      }
      if (updateData.promptsFlow !== undefined) {
        clientCustomPrompt.promptsFlow = updateData.promptsFlow;
      }

      await clientCustomPrompt.save();

      // Update VAPI assistant if prompt is for voice and agentID exists
      if (
        clientCustomPrompt.promptType !== "web-chat" &&
        updateData.prompt !== undefined &&
        clientCustomPrompt.agentID
      ) {
        await this.updateVapiAssistant(clientCustomPrompt);
      }

      return clientCustomPrompt;
    } catch (error) {
      console.error("Error updating client custom prompt:", error);
      throw error;
    }
  }

  /**
   * Update a client custom prompt by organization ID and prompt type
   * If no custom prompt exists, create a new one
   */
  async updateByOrganizationAndType(organizationId, promptType, updateData) {
    try {
      // Find existing prompt
      let clientCustomPrompt = await ClientCustomPrompt.findOne({
        organizationId,
        promptType,
      });

      if (clientCustomPrompt) {
        // Update existing prompt
        if (updateData.prompt !== undefined) {
          clientCustomPrompt.prompt = updateData.prompt;
        }
        if (updateData.callInitiationType !== undefined) {
          clientCustomPrompt.callInitiationType = updateData.callInitiationType;
        }
        if (updateData.staticMessage !== undefined) {
          clientCustomPrompt.staticMessage = updateData.staticMessage;
        }
        if (updateData.isActive !== undefined) {
          clientCustomPrompt.isActive = updateData.isActive;
        }
        if (updateData.agentID !== undefined) {
          clientCustomPrompt.agentID = updateData.agentID;
        }
        if (updateData.promptsFlow !== undefined) {
          clientCustomPrompt.promptsFlow = updateData.promptsFlow;
        }

        await clientCustomPrompt.save();
      } else {
        // Create new prompt if it doesn't exist
        const promptData = {
          organizationId,
          promptType,
          prompt: updateData.prompt,
          callInitiationType: updateData.callInitiationType,
          staticMessage: updateData.staticMessage,
          agentID: updateData.agentID,
        };
        
        clientCustomPrompt = await this.createOrRetrieve(promptData);
      }

      // Update VAPI assistant if prompt is for voice and agentID exists
      if (
        clientCustomPrompt.promptType !== "web-chat" &&
        updateData.prompt !== undefined &&
        clientCustomPrompt.agentID
      ) {
        await this.updateVapiAssistant(clientCustomPrompt);
      }

      return clientCustomPrompt;
    } catch (error) {
      console.error("Error updating client custom prompt by organization and type:", error);
      throw error;
    }
  }

  /**
   * Delete a client custom prompt
   */
  async delete(promptId) {
    try {
      const result = await ClientCustomPrompt.findByIdAndDelete(promptId);
      if (!result) {
        throw new Error("Client custom prompt not found");
      }
      return result;
    } catch (error) {
      console.error("Error deleting client custom prompt:", error);
      throw error;
    }
  }

  /**
   * Update VAPI assistant with new prompt and call initiation settings
   */
  async updateVapiAssistant(clientCustomPrompt) {
    try {
      // Only update if prompt is provided and it's not web-chat
      if (
        !clientCustomPrompt.prompt ||
        clientCustomPrompt.promptType === "web-chat"
      ) {
        console.log(
          "No prompt provided or web-chat type, skipping VAPI update"
        );
        return;
      }

      if (!clientCustomPrompt.agentID) {
        console.log("No agent ID found for client custom prompt");
        return;
      }

      // Prepare the update data for VAPI
      const updateData = {
        ...vapiService.buildMarketingAnalysisPlan(),
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                clientCustomPrompt.prompt +
                `
The current date is {{now}}.
IMPORTANT INSTRUCTION:  
Before booking any appointment, you **MUST** first confirm the user's email address.  
- Always call the \`email_collection_tool\` to collect the user's email.  
- Do **NOT** proceed to call the \`Appointment_BookingTool\` until you have successfully obtained and confirmed the user's email from them.  
- Under no circumstances should you attempt to book a meeting without first using the \`email_collection_tool\` and receiving a valid email from the user.

${multilingualExtension}
`,
            },
          ],
        },
      };

      // Add call initiation settings based on type
      switch (clientCustomPrompt.callInitiationType) {
        case "ai-initiates":
          updateData.firstMessageMode = "assistant-speaks-first";
          break;
        case "human-initiates":
          updateData.firstMessageMode = "assistant-waits-for-user";
          break;
        case "ai-initiates-static":
          updateData.firstMessageMode = "assistant-speaks-first";
          if (clientCustomPrompt.staticMessage) {
            updateData.firstMessage = clientCustomPrompt.staticMessage;
          }
          break;
      }

      // Build tools based on clientCustomPrompt.tools configuration
      // For non-web-chat (voice), include configured tools; for web-chat, skip tools here (handled elsewhere)
      if (clientCustomPrompt.promptType !== "web-chat") {
        const toolsConfig = clientCustomPrompt.tools && clientCustomPrompt.tools.length > 0 
          ? clientCustomPrompt.tools 
          : [{ name: "knowledgebase" }, { name: "endcall" }, { name: "bookappointment" }]; // fallback to defaults
        
        updateData.model.tools = await vapiService.buildToolsFromConfig(
          toolsConfig,
          clientCustomPrompt.organizationId,
          { isMarketing: true }
        );
      }

      // Call VAPI API to update the assistant
      await vapiService.updateAssistant(clientCustomPrompt.agentID, updateData);

      console.log(
        `✅ Updated VAPI assistant ${clientCustomPrompt.agentID} with new prompt and settings`
      );
    } catch (error) {
      console.error("❌ Error updating VAPI assistant:", error);
      throw new Error("Failed to update VAPI assistant");
    }
  }

  /**
   * Get all prompts for an organization
   */
  async getAllByOrganization(organizationId) {
    try {
      return await ClientCustomPrompt.find({ organizationId, isActive: true });
    } catch (error) {
      console.error("Error getting all client custom prompts:", error);
      return [];
    }
  }
}

const clientCustomPromptService = new ClientCustomPromptService();

module.exports = { clientCustomPromptService };
