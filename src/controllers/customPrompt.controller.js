const { customPromptService } = require("../services/customPrompt.service");
const mongoose = require("mongoose");
const { generateAssistantPrompt } = require("../utils/prompts");
const { Mechanic } = require("../models");

/**
 * Create or retrieve a custom prompt for a mechanic
 */
const createOrRetrieveCustomPrompt = async (req, res) => {
  try {
    const {
      mechanicId,
      chatPrompt,
      voicePrompt,
      callInitiationType,
      staticMessage,
    } = req.body;

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: "Mechanic ID is required",
      });
    }

    // Validate mechanicId is a valid ObjectId
    if (!mongoose.isValidObjectId(mechanicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mechanic ID format",
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

    const result = await customPromptService.createOrRetrieve({
      mechanicId,
      chatPrompt,
      voicePrompt,
      callInitiationType,
      staticMessage,
    });

    // Check if this was a new creation or existing prompt
    const isNewPrompt =
      !result.createdAt ||
      new Date(result.createdAt).getTime() ===
        new Date(result.updatedAt).getTime();

    res.status(200).json({
      success: true,
      data: result,
      message: isNewPrompt
        ? "Custom prompt created successfully"
        : "Custom prompt retrieved successfully",
    });
  } catch (error) {
    console.error("Error creating/retrieving custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create/retrieve custom prompt",
    });
  }
};

/**
 * Update a custom prompt
 */
const updateCustomPrompt = async (req, res) => {
  try {
    const { promptId } = req.params;
    const {
      chatPrompt,
      voicePrompt,
      callInitiationType,
      staticMessage,
      isActive,
    } = req.body;

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
    if (chatPrompt !== undefined) updateData.chatPrompt = chatPrompt;
    if (voicePrompt !== undefined) updateData.voicePrompt = voicePrompt;
    if (callInitiationType !== undefined)
      updateData.callInitiationType = callInitiationType;
    if (staticMessage !== undefined) updateData.staticMessage = staticMessage;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await customPromptService.update(promptId, updateData);

    res.status(200).json({
      success: true,
      data: result,
      message: "Custom prompt updated successfully",
    });
  } catch (error) {
    console.error("Error updating custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update custom prompt",
    });
  }
};

/**
 * Get custom prompt by mechanic ID
 */
const getCustomPromptByMechanicId = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    if (!mongoose.isValidObjectId(mechanicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mechanic ID format",
      });
    }

    const mechanicData = await Mechanic.findById(mechanicId);

    const result = await customPromptService.findByMechanicId(mechanicId);
    const vapiAssistantId = await customPromptService.getVapiAssistantId(
      mechanicId
    );

    // If no custom prompt found, return default prompt structure
    if (!result) {
      const prompt = generateAssistantPrompt(
        mechanicData.firstName + " " + mechanicData.lastName,
        mechanicData.specialty,
        mechanicData.serviceCapabilities?.join(", ") +
          mechanicData.OtherServices
      );
      const defaultPrompt = {
        _id: null,
        mechanicId: mechanicId,
        chatPrompt: prompt,
        voicePrompt: prompt,
        isActive: true,
        callInitiationType: "ai-initiates",
        staticMessage: "",
        createdAt: null,
        updatedAt: null,
        isDefault: true,
        agentID: vapiAssistantId || null,
      };

      return res.status(200).json({
        success: true,
        data: defaultPrompt,
        message: "No custom prompt found, returning default structure",
      });
    }

    // Add agentID to the existing result
    const resultWithAgentId = {
      ...(result.toObject ? result.toObject() : result),
      agentID: vapiAssistantId || null,
    };
    console.log("resultWithAgentId", resultWithAgentId);
    res.status(200).json({
      success: true,
      data: resultWithAgentId,
    });
  } catch (error) {
    console.error("Error getting custom prompt:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get custom prompt",
    });
  }
};

/**
 * Get VAPI assistant ID for a mechanic
 */
const getVapiAssistantId = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    if (!mongoose.isValidObjectId(mechanicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mechanic ID format",
      });
    }

    const vapiAssistantId = await customPromptService.getVapiAssistantId(
      mechanicId
    );

    res.status(200).json({
      success: true,
      data: { vapiAssistantId },
    });
  } catch (error) {
    console.error("Error getting VAPI assistant ID:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get VAPI assistant ID",
    });
  }
};

module.exports = {
  createOrRetrieveCustomPrompt,
  updateCustomPrompt,
  getCustomPromptByMechanicId,
  getVapiAssistantId,
};
