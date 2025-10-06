const vapiService = require("../services/vapi.service");
const { HTTP_STATUS_CODES } = require("../helper");

/**
 * Update VAPI assistant call settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAssistantCallSettings = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const {
      // Frontend format
      voicemailDetection,
      userKeypadInput,
      endCallOnSilence,
      maxCallDuration,
      pauseBeforeSpeaking,
      ringDuration,

      // Additional settings
      firstMessage,
      firstMessageMode,
      backgroundSound,
      maxDurationSeconds,
    } = req.body;

    // Validate required parameters
    if (!assistantId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Assistant ID is required",
      });
    }

    // Build update configuration object for VAPI API
    const updateConfig = {};

    // Voicemail Detection - Map to VAPI schema
    if (voicemailDetection !== undefined) {
      if (voicemailDetection.enabled) {
        updateConfig.voicemailDetection = {
          beepMaxAwaitSeconds: 30,
          provider: "google",
          backoffPlan: {
            startAtSeconds: 5,
            frequencySeconds: 5,
            maxRetries: 6,
          },
          type: "audio",
        };
      } else {
        updateConfig.voicemailDetection = null;
      }
    }

    // Keypad Input Detection - Map to VAPI schema
    if (userKeypadInput !== undefined) {
      if (userKeypadInput.enabled) {
        updateConfig.keypadInputPlan = {
          enabled: true,
          timeoutSeconds: userKeypadInput.timeout || 2.5,
          delimiters: [userKeypadInput.terminationKey],
        };
      } else {
        updateConfig.keypadInputPlan = {
          enabled: false,
        };
      }
    }

    // End Call on Silence - Map to VAPI schema
    if (endCallOnSilence !== undefined) {
      if (endCallOnSilence.enabled) {
        updateConfig.stopSpeakingPlan = {
          numWords: 0,
          voiceSeconds: 0.2,
          backoffSeconds: endCallOnSilence.duration || 5,
        };
      } else {
        updateConfig.stopSpeakingPlan = {
          numWords: 0,
          voiceSeconds: 0.2,
          backoffSeconds: 0,
        };
      }
    }

    // Call Duration & Timing
    if (maxCallDuration !== undefined) {
      // Convert hours to seconds for VAPI
      updateConfig.maxDurationSeconds = Math.round(maxCallDuration * 3600);
    }

    if (maxDurationSeconds !== undefined) {
      updateConfig.maxDurationSeconds = maxDurationSeconds;
    }

    if (pauseBeforeSpeaking !== undefined) {
      updateConfig.startSpeakingPlan = {
        waitSeconds: pauseBeforeSpeaking,
        smartEndpointingPlan: {
          provider: "vapi",
        },
        smartEndpointingEnabled: false,
      };
    }

    if (ringDuration !== undefined) {
      updateConfig.transportConfigurations = [
        {
          provider: "twilio",
          timeout: ringDuration,
          record: false,
          recordingChannels: "mono",
        },
      ];
    }

    // First Message Configuration
    if (firstMessage !== undefined) {
      updateConfig.firstMessage = firstMessage;
    }

    if (firstMessageMode !== undefined) {
      updateConfig.firstMessageMode = firstMessageMode;
    }

    // Background Sound Configuration
    if (backgroundSound !== undefined) {
      updateConfig.backgroundSound = backgroundSound;
    }

    console.log(
      `🔄 Updating VAPI assistant ${assistantId} with settings:`,
      updateConfig
    );

    // Update the assistant using VAPI service
    const updatedAssistant = await vapiService.updateAssistant(
      assistantId,
      updateConfig
    );

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: updatedAssistant,
      message: "VAPI assistant call settings updated successfully",
      updatedSettings: updateConfig,
    });
  } catch (error) {
    console.error("Error updating VAPI assistant call settings:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update VAPI assistant call settings",
      error: error.message,
    });
  }
};

/**
 * Get current VAPI assistant call settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAssistantCallSettings = async (req, res) => {
  try {
    const { assistantId } = req.params;

    if (!assistantId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Assistant ID is required",
      });
    }

    // Get assistant details from VAPI
    const assistant = await vapiService.getAssistant(assistantId);

    // Map VAPI response to frontend expected format
    const callSettings = {
      // Voicemail Detection - Map from VAPI schema
      voicemailDetection: {
        enabled: assistant.voicemailDetection !== null,
        action: "hang-up", // Default action
      },

      // Keypad Input Detection - Map from VAPI schema
      userKeypadInput: {
        enabled: assistant.keypadInputPlan?.enabled || false,
        timeout: assistant.keypadInputPlan?.timeoutSeconds || 2.5,
        terminationKey: [assistant.keypadInputPlan?.delimiters],
        digitLimit: 1, // Default value as VAPI doesn't have this field
      },

      // End Call on Silence - Map from VAPI schema
      endCallOnSilence: {
        enabled: assistant.stopSpeakingPlan?.backoffSeconds > 0 || false,
        duration: assistant.stopSpeakingPlan?.backoffSeconds || 5,
      },

      // Call Duration & Timing
      maxCallDuration: assistant.maxDurationSeconds
        ? Math.round((assistant.maxDurationSeconds / 3600) * 100) / 100
        : 0.17, // Convert from seconds to hours
      pauseBeforeSpeaking: assistant.startSpeakingPlan?.waitSeconds || 0,
      ringDuration: assistant.transportConfigurations?.[0]?.timeout || 30,
    };

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: callSettings,
      message: "VAPI assistant call settings retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting VAPI assistant call settings:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve VAPI assistant call settings",
      error: error.message,
    });
  }
};

/**
 * Update specific VAPI assistant setting category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAssistantSettingCategory = async (req, res) => {
  try {
    const { assistantId, category } = req.params;
    const settings = req.body;

    if (!assistantId || !category) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Assistant ID and category are required",
      });
    }

    let updateConfig = {};

    switch (category) {
      case "voicemail":
        if (settings.enabled) {
          updateConfig.voicemailDetection = {
            beepMaxAwaitSeconds: 30,
            provider: "google",
            backoffPlan: {
              startAtSeconds: 5,
              frequencySeconds: 5,
              maxRetries: 6,
            },
            type: "audio",
          };
        } else {
          updateConfig.voicemailDetection = null;
        }
        break;

      case "keypad":
        if (settings.enabled) {
          updateConfig.keypadInputPlan = {
            enabled: true,
            timeoutSeconds: settings.timeout || 2.5,
            delimiters: [settings.terminationKey],
          };
        } else {
          updateConfig.keypadInputPlan = {
            enabled: false,
          };
        }
        break;

      case "silence":
        if (settings.enabled) {
          updateConfig.stopSpeakingPlan = {
            numWords: 0,
            voiceSeconds: 0.2,
            backoffSeconds: settings.duration || 5,
          };
        } else {
          updateConfig.stopSpeakingPlan = {
            numWords: 0,
            voiceSeconds: 0.2,
            backoffSeconds: 0,
          };
        }
        break;

      case "timing":
        if (settings.maxCallDuration !== undefined) {
          updateConfig.maxDurationSeconds = Math.round(
            settings.maxCallDuration * 3600
          );
        }
        if (settings.pauseBeforeSpeaking !== undefined) {
          updateConfig.startSpeakingPlan = {
            waitSeconds: settings.pauseBeforeSpeaking,
            smartEndpointingPlan: {
              provider: "vapi",
            },
            smartEndpointingEnabled: false,
          };
        }
        if (settings.ringDuration !== undefined) {
          updateConfig.transportConfigurations = [
            {
              provider: "twilio",
              timeout: settings.ringDuration,
              record: false,
              recordingChannels: "mono",
            },
          ];
        }
        break;

      default:
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message:
            "Invalid category. Supported categories: voicemail, keypad, silence, timing",
        });
    }

    console.log(
      `🔄 Updating VAPI assistant ${assistantId} ${category} settings:`,
      updateConfig
    );

    // Update the assistant using VAPI service
    const updatedAssistant = await vapiService.updateAssistant(
      assistantId,
      updateConfig
    );

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: updatedAssistant,
      message: `VAPI assistant ${category} settings updated successfully`,
      updatedSettings: updateConfig,
    });
  } catch (error) {
    console.error(
      `Error updating VAPI assistant ${req.params.category} settings:`,
      error
    );
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to update VAPI assistant ${req.params.category} settings`,
      error: error.message,
    });
  }
};
