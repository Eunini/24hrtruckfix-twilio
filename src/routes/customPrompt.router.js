const express = require("express");
const {
  createOrRetrieveCustomPrompt,
  updateCustomPrompt,
  getCustomPromptByMechanicId,
  getVapiAssistantId,
} = require("../controllers/customPrompt.controller");
const { authenticate } = require("../middleware/auth");

const customPromptRouter = express.Router();

/**
 * @route POST /api/v1/custom-prompts
 * @desc Create or retrieve a custom prompt for a mechanic
 * @body {mechanicId, chatPrompt, voicePrompt, callInitiationType, staticMessage}
 * @access Private
 */
customPromptRouter.post("/", authenticate, createOrRetrieveCustomPrompt);

/**
 * @route PUT /api/v1/custom-prompts/:promptId
 * @desc Update a custom prompt
 * @body {chatPrompt, voicePrompt, callInitiationType, staticMessage, isActive}
 * @access Private
 */
customPromptRouter.put("/:promptId", authenticate, updateCustomPrompt);

/**
 * @route GET /api/v1/custom-prompts/mechanic/:mechanicId
 * @desc Get custom prompt by mechanic ID
 * @access Private
 */
customPromptRouter.get(
  "/mechanic/:mechanicId",
  authenticate,
  getCustomPromptByMechanicId
);

/**
 * @route GET /api/v1/custom-prompts/mechanic/:mechanicId/vapi-assistant
 * @desc Get VAPI assistant ID for a mechanic
 * @access Private
 */
customPromptRouter.get(
  "/mechanic/:mechanicId/vapi-assistant",
  authenticate,
  getVapiAssistantId
);

module.exports = customPromptRouter;
