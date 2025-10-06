const {
  clientCustomPromptService,
} = require("../services/clientCustomPrompt.service");
const mongoose = require("mongoose");
const { Organization } = require("../models");
const aiConfigService = require("../services/aiConfig.service");
const outboundPrompt = require("../utils/prompts/outbound_prompt");
const insurancePrompt = require("../utils/prompts/insurance.prompt");

/**
 * Helper function to resolve agentID for frontend response based on prompt type
 */
const resolveAgentIdForResponse = async (promptData, organizationId) => {
  if (!promptData || promptData.promptType === "web-chat") {
    return promptData;
  }

  // If agentID already exists, return as is
  if (promptData.agentID) {
    return promptData;
  }

  // For dispatch and concierge, get from AIConfig
  if (
    promptData.promptType === "dispatch" ||
    promptData.promptType === "concierge"
  ) {
    try {
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
        organizationId
      );
      if (aiConfig) {
        const resolvedAgentID =
          promptData.promptType === "dispatch"
            ? aiConfig.outbound_assistant_id
            : aiConfig.inbound_assistant_id;

        return {
          ...promptData,
          agentID: resolvedAgentID || null,
        };
      }
    } catch (error) {
      console.error("Error resolving agent ID for response:", error);
    }
  }

  return promptData;
};

/**
 * Create or retrieve a client custom prompt for an organization
 */
const createOrRetrieveClientCustomPrompt = async (req, res) => {
  try {
    const {
      organizationId,
      prompt,
      callInitiationType,
      staticMessage,
      promptType,
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    if (!promptType) {
      return res.status(400).json({
        success: false,
        message: "Prompt type is required",
      });
    }

    // Validate organizationId is a valid ObjectId
    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    // Validate promptType
    const validPromptTypes = [
      "web-chat",
      "web-voice",
      "inbound-voice",
      "outbound-voice",
      "dispatch",
      "concierge",
    ];
    if (!validPromptTypes.includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid prompt type. Must be one of: ${validPromptTypes.join(
          ", "
        )}`,
      });
    }

    // Validate callInitiationType if provided
    if (
      callInitiationType &&
      !["ai-initiates", "human-initiates", "ai-initiates-static"].includes(
        callInitiationType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call initiation type. Must be one of: ai-initiates, human-initiates, ai-initiates-static",
      });
    }

    // Validate staticMessage if callInitiationType is ai-initiates-static
    if (callInitiationType === "ai-initiates-static" && !staticMessage) {
      return res.status(400).json({
        success: false,
        message:
          "Static message is required when call initiation type is ai-initiates-static",
      });
    }

    // Validate agentID for non-web-chat prompt types
    const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
      organizationId
    );
    const agentID =
      aiConfig.markerting_agents[
        promptType === "web-voice"
          ? "web"
          : promptType === "inbound-voice"
          ? "inbound"
          : "outbound"
      ];
    if (promptType !== "web-chat" && !agentID) {
      return res.status(400).json({
        success: false,
        message: "invalid marketing agent",
      });
    }

    const result = await clientCustomPromptService.createOrRetrieve({
      organizationId,
      prompt,
      callInitiationType,
      staticMessage,
      promptType,
      agentID,
    });

    // Check if this was a new creation or existing prompt
    const isNewPrompt =
      !result.createdAt ||
      new Date(result.createdAt).getTime() ===
        new Date(result.updatedAt).getTime();

    // Resolve agentID for frontend response
    const responseData = await resolveAgentIdForResponse(
      result.toJSON ? result.toJSON() : result,
      organizationId
    );

    res.status(isNewPrompt ? 201 : 200).json({
      success: true,
      data: responseData,
      message: isNewPrompt
        ? "Client custom prompt created successfully"
        : "Client custom prompt retrieved and updated successfully",
    });
  } catch (error) {
    console.error("Error creating/retrieving client custom prompt:", error);
    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to create/retrieve client custom prompt",
    });
  }
};

/**
 * Update a client custom prompt
 */
const updateClientCustomPrompt = async (req, res) => {
  try {
    const { promptId } = req.params;
    const { prompt, callInitiationType, staticMessage, isActive } = req.body;

    if (!mongoose.isValidObjectId(promptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prompt ID format",
      });
    }

    // Validate callInitiationType if provided
    if (
      callInitiationType &&
      !["ai-initiates", "human-initiates", "ai-initiates-static"].includes(
        callInitiationType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call initiation type. Must be one of: ai-initiates, human-initiates, ai-initiates-static",
      });
    }

    // Validate staticMessage if callInitiationType is ai-initiates-static
    if (callInitiationType === "ai-initiates-static" && !staticMessage) {
      return res.status(400).json({
        success: false,
        message:
          "Static message is required when call initiation type is ai-initiates-static",
      });
    }

    const updateData = {};
    if (prompt !== undefined) updateData.prompt = prompt;
    if (callInitiationType !== undefined)
      updateData.callInitiationType = callInitiationType;
    if (staticMessage !== undefined) updateData.staticMessage = staticMessage;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await clientCustomPromptService.update(promptId, updateData);

    // Resolve agentID for frontend response
    const responseData = await resolveAgentIdForResponse(
      result.toJSON ? result.toJSON() : result,
      result.organizationId
    );

    res.status(200).json({
      success: true,
      data: responseData,
      message: "Client custom prompt updated successfully",
    });
  } catch (error) {
    console.error("Error updating client custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update client custom prompt",
    });
  }
};

/**
 * Update promptsFlow for a client custom prompt
 */
const updatePromptsFlow = async (req, res) => {
  try {
    const { promptId } = req.params;
    const { promptsFlow } = req.body;

    if (!mongoose.isValidObjectId(promptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prompt ID format",
      });
    }

    if (!promptsFlow || typeof promptsFlow !== "object") {
      return res.status(400).json({
        success: false,
        message: "promptsFlow must be a valid object",
      });
    }

    const updateData = {
      promptsFlow,
    };

    const result = await clientCustomPromptService.update(promptId, updateData);

    res.status(200).json({
      success: true,
      data: result,
      message: "Prompts flow updated successfully",
    });
  } catch (error) {
    console.error("Error updating prompts flow:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update prompts flow",
    });
  }
};

/**
 * Update a client custom prompt by organization ID and prompt type
 * If no custom prompt exists, create a new one
 */
const updateClientCustomPromptByOrganizationAndType = async (req, res) => {
  try {
    const { organizationId, promptType } = req.params;
    const { prompt, callInitiationType, staticMessage, isActive, agentID } =
      req.body;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    // Validate promptType
    const validPromptTypes = [
      "web-chat",
      "web-voice",
      "inbound-voice",
      "outbound-voice",
      "dispatch",
      "concierge",
    ];
    if (!validPromptTypes.includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid prompt type. Must be one of: ${validPromptTypes.join(
          ", "
        )}`,
      });
    }

    // Validate callInitiationType if provided
    if (
      callInitiationType &&
      !["ai-initiates", "human-initiates", "ai-initiates-static"].includes(
        callInitiationType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call initiation type. Must be one of: ai-initiates, human-initiates, ai-initiates-static",
      });
    }

    // Validate staticMessage if callInitiationType is ai-initiates-static
    if (callInitiationType === "ai-initiates-static" && !staticMessage) {
      return res.status(400).json({
        success: false,
        message:
          "Static message is required when call initiation type is ai-initiates-static",
      });
    }

    const updateData = {};
    if (prompt !== undefined) updateData.prompt = prompt;
    if (callInitiationType !== undefined)
      updateData.callInitiationType = callInitiationType;
    if (staticMessage !== undefined) updateData.staticMessage = staticMessage;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (agentID !== undefined) updateData.agentID = agentID;

    const result = await clientCustomPromptService.updateByOrganizationAndType(
      organizationId,
      promptType,
      updateData
    );

    // Resolve agentID for frontend response
    const responseData = await resolveAgentIdForResponse(
      result.toJSON ? result.toJSON() : result,
      organizationId
    );

    res.status(200).json({
      success: true,
      data: responseData,
      message: "Client custom prompt updated successfully",
    });
  } catch (error) {
    console.error(
      "Error updating client custom prompt by organization and type:",
      error
    );
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update client custom prompt",
    });
  }
};

/**
 * Get client custom prompt by organization ID and prompt type
 */
const getClientCustomPromptByOrganizationAndType = async (req, res) => {
  try {
    const { organizationId, promptType } = req.params;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    const validPromptTypes = [
      "web-chat",
      "web-voice",
      "inbound-voice",
      "outbound-voice",
      "dispatch",
      "concierge",
    ];
    if (!validPromptTypes.includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid prompt type. Must be one of: ${validPromptTypes.join(
          ", "
        )}`,
      });
    }

    const result = await clientCustomPromptService.findByOrganizationIdAndType(
      organizationId,
      promptType
    );

    let phoneNumber = null;
    if (promptType === "inbound-voice") {
      console.log("inbound-voice");
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
        organizationId
      );
      console.log("aiConfig", aiConfig);
      phoneNumber = aiConfig.markerting_agents.phone_number;
      console.log("phoneNumber", phoneNumber);
    }

    if (promptType === "concierge") {
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
        organizationId
      );
      console.log("aiConfig", aiConfig);
      phoneNumber = aiConfig.number;
      console.log("phoneNumber", phoneNumber);
    }

    // If no custom prompt exists, check for default prompts
    if (!result) {
      let defaultPrompt = null;

      // Return default prompt for dispatch and concierge types
      if (promptType === "dispatch") {
        // Create sample ticket data for dispatch prompt
        const sampleTicketData = {
          companyName: "24Hr Truck Services",
          vehicleInfo: "Blue 2020 Ford F-150",
          ownerNumber: "+1234567890",
          distance: "5 miles",
          ticketType: "repair",
          primaryReason: "Engine trouble",
          secondaryReason: "Vehicle won't start",
          breakdownAddress: "123 Main St, City, State",
          towDestination: null,
          displayName: { text: "Sample Mechanic" },
          ticket: {
            _id: "sample_ticket_id",
            breakdown_reason: "Engine issue",
            tow_destination: null,
          },
          ticketId: "sample_ticket_id",
        };

        defaultPrompt = {
          organizationId,
          promptType: "dispatch",
          prompt: outboundPrompt.dispatchCallSystemPrompt(sampleTicketData),
          callInitiationType: "ai-initiates",
          staticMessage: "",
          isActive: true,
        };
      } else if (promptType === "concierge") {
        // Create sample client data for insurance prompt
        const sampleClientData = {
          clientData: {
            companyDetails: {
              companyName: "24Hr Truck Services",
            },
          },
          vapi: {
            message: {
              customer: {
                number: "+1234567890",
              },
            },
          },
        };

        defaultPrompt = {
          organizationId,
          promptType: "concierge",
          prompt:
            insurancePrompt.conciergeAIModel(sampleClientData)?.messages[0]
              ?.content,
          callInitiationType: "ai-initiates",
          staticMessage: "",
          isActive: true,
        };
      }

      if (defaultPrompt) {
        // Resolve agentID for default prompt response
        const responseData = await resolveAgentIdForResponse(
          defaultPrompt,
          organizationId
        );

        return res.status(200).json({
          success: true,
          data: { ...responseData, phoneNumber },
        });
      }

      // For other prompt types or if phoneNumber exists
      if (phoneNumber) {
        return res.status(200).json({
          success: true,
          data: { phoneNumber },
        });
      }

      // No custom prompt and no default available
      return res.status(404).json({
        success: false,
        message: "Client custom prompt not found",
      });
    }

    // Resolve agentID for frontend response
    const responseData = await resolveAgentIdForResponse(
      result.toJSON ? result.toJSON() : result,
      organizationId
    );

    res.status(200).json({
      success: true,
      data: { ...responseData, phoneNumber },
    });
  } catch (error) {
    console.error("Error getting client custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get client custom prompt",
    });
  }
};

/**
 * Get all client custom prompts by organization ID
 */
const getAllClientCustomPromptsByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    const result = await clientCustomPromptService.getAllByOrganization(
      organizationId
    );

    // Resolve agentID for each prompt in the response
    const responseData = await Promise.all(
      result.map(async (prompt) => {
        return await resolveAgentIdForResponse(
          prompt.toJSON ? prompt.toJSON() : prompt,
          organizationId
        );
      })
    );

    res.status(200).json({
      success: true,
      data: responseData,
      message: "Client custom prompts retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting client custom prompts:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get client custom prompts",
    });
  }
};

/**
 * Delete a client custom prompt
 */
const deleteClientCustomPrompt = async (req, res) => {
  try {
    const { promptId } = req.params;

    if (!mongoose.isValidObjectId(promptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prompt ID format",
      });
    }

    const result = await clientCustomPromptService.delete(promptId);

    res.status(200).json({
      success: true,
      data: result,
      message: "Client custom prompt deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting client custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete client custom prompt",
    });
  }
};

module.exports = {
  createOrRetrieveClientCustomPrompt,
  updateClientCustomPrompt,
  updatePromptsFlow,
  updateClientCustomPromptByOrganizationAndType,
  getClientCustomPromptByOrganizationAndType,
  getAllClientCustomPromptsByOrganization,
  deleteClientCustomPrompt,
};
