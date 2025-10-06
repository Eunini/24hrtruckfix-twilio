const express = require("express");
const router = express.Router();
const vapiSettingsController = require("../controllers/vapiSettings.controller");
const { authenticate } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route PATCH /api/v1/vapi/assistant/:assistantId/settings
 * @desc Update VAPI assistant call settings
 * @access Private
 */
router.patch(
  "/assistant/:assistantId/settings",
  vapiSettingsController.updateAssistantCallSettings
);

/**
 * @route GET /api/v1/vapi/assistant/:assistantId/settings
 * @desc Get current VAPI assistant call settings
 * @access Private
 */
router.get(
  "/assistant/:assistantId/settings",
  vapiSettingsController.getAssistantCallSettings
);

/**
 * @route PATCH /api/v1/vapi/assistant/:assistantId/settings/:category
 * @desc Update specific VAPI assistant setting category
 * @access Private
 * @param {string} category - Setting category (voicemail, keypad, silence, timing)
 */
router.patch(
  "/assistant/:assistantId/settings/:category",
  vapiSettingsController.updateAssistantSettingCategory
);

module.exports = router;
