const mongoose = require("mongoose");
const CustomPrompt = require("../models/customPrompt.model");
const vapiService = require("./vapi.service");
const { Mechanic } = require("../models");
const { multilingualExtension } = require("../utils/prompts/general");
// env not needed here after centralizing tool builders

class CustomPromptService {
  /**
   * Find a custom prompt by ID
   */
  async findById(promptId) {
    try {
      return await CustomPrompt.findById(promptId);
    } catch (error) {
      console.error("Error finding custom prompt:", error);
      return null;
    }
  }

  /**
   * Find a custom prompt by mechanic ID
   */
  async findByMechanicId(mechanicId) {
    try {
      return await CustomPrompt.findOne({ mechanicId });
    } catch (error) {
      console.error("Error finding custom prompt by mechanic ID:", error);
      return null;
    }
  }

  /**
   * Create or retrieve a custom prompt for a mechanic
   */
  async createOrRetrieve(promptData) {
    try {
      const {
        mechanicId,
        chatPrompt,
        voicePrompt,
        callInitiationType,
        staticMessage,
      } = promptData;

      // Check if prompt already exists for this mechanic
      let customPrompt = await CustomPrompt.findOne({ mechanicId });

      if (customPrompt) {
        // Update existing prompt
        customPrompt.chatPrompt = chatPrompt || customPrompt.chatPrompt;
        customPrompt.voicePrompt = voicePrompt || customPrompt.voicePrompt;
        customPrompt.callInitiationType =
          callInitiationType || customPrompt.callInitiationType;
        customPrompt.staticMessage =
          staticMessage || customPrompt.staticMessage;
        customPrompt.isActive = true;
      } else {
        // Create new prompt with default values
        customPrompt = new CustomPrompt({
          mechanicId,
          chatPrompt: chatPrompt || "",
          voicePrompt: voicePrompt || "",
          callInitiationType: callInitiationType || "ai-initiates",
          staticMessage: staticMessage || "",
          isActive: true,
        });
      }

      await customPrompt.save();

      // Update VAPI assistant if mechanic has one and voice prompt is provided
      if (voicePrompt) {
        await this.updateVapiAssistant(customPrompt);
      }

      return customPrompt;
    } catch (error) {
      console.error("Error creating/retrieving custom prompt:", error);
      throw error;
    }
  }

  /**
   * Update a custom prompt
   */
  async update(promptId, updateData) {
    try {
      const customPrompt = await CustomPrompt.findById(promptId);

      if (!customPrompt) {
        throw new Error("Custom prompt not found");
      }

      // Update fields
      if (updateData.chatPrompt !== undefined) {
        customPrompt.chatPrompt = updateData.chatPrompt;
      }
      if (updateData.voicePrompt !== undefined) {
        customPrompt.voicePrompt = updateData.voicePrompt;
      }
      if (updateData.callInitiationType !== undefined) {
        customPrompt.callInitiationType = updateData.callInitiationType;
      }
      if (updateData.staticMessage !== undefined) {
        customPrompt.staticMessage = updateData.staticMessage;
      }
      if (updateData.isActive !== undefined) {
        customPrompt.isActive = updateData.isActive;
      }

      await customPrompt.save();

      // Update VAPI assistant if voice prompt is provided
      if (updateData.voicePrompt !== undefined) {
        await this.updateVapiAssistant(customPrompt);
      }

      return customPrompt;
    } catch (error) {
      console.error("Error updating custom prompt:", error);
      throw error;
    }
  }

  /**
   * Update VAPI assistant with new voice prompt and call initiation settings
   */
  async updateVapiAssistant(customPrompt) {
    try {
      // Get mechanic to find web_agent_id
      const mechanic = await Mechanic.findById(customPrompt.mechanicId);

      if (!mechanic || !mechanic.web_agent_id) {
        console.log("No VAPI assistant ID found for mechanic");
        return;
      }

      // Only update if voice prompt is provided
      if (!customPrompt.voicePrompt) {
        console.log("No voice prompt provided, skipping VAPI update");
        return;
      }

      // Prepare the update data for VAPI
      const updateData = {
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                customPrompt.voicePrompt +
                `\n\nThe current date is {{now}}\n\nAlso please note when booking the appointment make sure to confirm the user's email first from them before even attempting to book a meeting you can call the email_collection_tool to show them a UI to pass in their email to you .\n\n${multilingualExtension}`,
            },
          ],
        },
      };

      // Add call initiation settings based on type
      switch (customPrompt.callInitiationType) {
        case "ai-initiates":
          updateData.firstMessageMode = "assistant-speaks-first";
          break;
        case "human-initiates":
          updateData.firstMessageMode = "assistant-waits-for-user";
          break;
        case "ai-initiates-static":
          updateData.firstMessageMode = "assistant-speaks-first";
          if (customPrompt.staticMessage) {
            updateData.firstMessage = customPrompt.staticMessage;
          }
          break;
      }

      // Build tools based on customPrompt.tools configuration
      const toolsConfig = customPrompt.tools && customPrompt.tools.length > 0 
        ? customPrompt.tools 
        : [{ name: "knowledgebase" }, { name: "endcall" }, { name: "bookappointment" }]; // fallback to defaults
      
      updateData.model.tools = await vapiService.buildToolsFromConfig(
        toolsConfig,
        customPrompt.mechanicId
      );

      // Call VAPI API to update the assistant
      await vapiService.updateAssistant(mechanic.web_agent_id, updateData);

      console.log(
        `✅ Updated VAPI assistant ${mechanic.web_agent_id} with new voice prompt and settings`
      );
    } catch (error) {
      console.error("❌ Error updating VAPI assistant:", error);
      throw new Error("Failed to update VAPI assistant");
    }
  }

  /**
   * Get VAPI assistant ID from mechanic's web_agent_id
   */
  async getVapiAssistantId(mechanicId) {
    try {
      const mechanic = await Mechanic.findById(mechanicId);
      return mechanic?.web_agent_id || null;
    } catch (error) {
      console.error("Error getting VAPI assistant ID:", error);
      return null;
    }
  }
}

const customPromptService = new CustomPromptService();

module.exports = { customPromptService };
