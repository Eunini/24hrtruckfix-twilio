const express = require("express");
const router = express.Router();
const {
  createOrRetrieveClientCustomPrompt,
  updateClientCustomPrompt,
  updatePromptsFlow,
  updateClientCustomPromptByOrganizationAndType,
  getClientCustomPromptByOrganizationAndType,
  getAllClientCustomPromptsByOrganization,
  deleteClientCustomPrompt,
} = require("../controllers/clientCustomPrompt.controller");

/**
 * @route   POST /api/client-custom-prompts
 * @desc    Create or retrieve a client custom prompt
 * @access  Private
 */
router.post("/", createOrRetrieveClientCustomPrompt);

/**
 * @route   PUT /api/client-custom-prompts/:promptId
 * @desc    Update a client custom prompt
 * @access  Private
 */
router.put("/:promptId", updateClientCustomPrompt);

/**
 * @route   PUT /api/client-custom-prompts/:promptId/prompts-flow
 * @desc    Update prompts flow for a client custom prompt
 * @access  Private
 */
router.put("/:promptId/prompts-flow", updatePromptsFlow);

/**
 * @route   PUT /api/client-custom-prompts/organization/:organizationId/:promptType
 * @desc    Update a client custom prompt by organization ID and prompt type
 * @access  Private
 */
router.put(
  "/organization/:organizationId/:promptType",
  updateClientCustomPromptByOrganizationAndType
);

/**
 * @route   GET /api/client-custom-prompts/organization/:organizationId/:promptType
 * @desc    Get client custom prompt by organization ID and prompt type
 * @access  Private
 */
router.get(
  "/organization/:organizationId/:promptType",
  getClientCustomPromptByOrganizationAndType
);

/**
 * @route   GET /api/client-custom-prompts/organization/:organizationId
 * @desc    Get all client custom prompts by organization ID
 * @access  Private
 */
router.get(
  "/organization/:organizationId",
  getAllClientCustomPromptsByOrganization
);

/**
 * @route   DELETE /api/client-custom-prompts/:promptId
 * @desc    Delete a client custom prompt
 * @access  Private
 */
router.delete("/:promptId", deleteClientCustomPrompt);

module.exports = router;
