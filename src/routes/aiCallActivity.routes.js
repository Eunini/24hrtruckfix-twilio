const express = require("express");
const router = express.Router();
const aiCallActivityController = require("../controllers/aiCallActivity.controller");
const { authenticate } = require("../middleware/auth");

/**
 * @route   GET /api/v1/ai-activity-call-activities
 * @desc    Get all AI call activities with pagination and filtering
 * @access  Private
 * @query   page, limit, search, sortField, sort, call_type, organization_id
 */
router.get("/", authenticate, aiCallActivityController.getAICallActivities);

/**
 * @route   GET /api/v1/ai-activity-call-activities/combined
 * @desc    Get all AI call activities with pagination and filtering
 * @access  Private
 * @query   page, limit, search, sortField, sort, call_type, organization_id
 */
router.get("/combined", authenticate, aiCallActivityController.getCombinedAICallActivities);

/**
 * @route   GET /api/v1/ai-activity-call-activities/:id
 * @desc    Get AI call activity by ID
 * @access  Private
 */
router.get(
  "/:id",
  authenticate,
  aiCallActivityController.getAICallActivityById
);

/**
 * @route   GET /api/v1/ai-activity-call-activities/call/:call_id
 * @desc    Get AI call activity by call_id
 * @access  Private
 */
router.get(
  "/call/:call_id",
  authenticate,
  aiCallActivityController.getAICallActivityByCallId
);

/**
 * @route   POST /api/v1/ai-activity-call-activities
 * @desc    Create a new AI call activity
 * @access  Private
 * @body    { call_id, organization_id, call_type, number }
 */
router.post("/", authenticate, aiCallActivityController.createAICallActivity);

/**
 * @route   DELETE /api/v1/ai-activity-call-activities/:id
 * @desc    Delete AI call activity by ID
 * @access  Private
 */
router.delete(
  "/:id",
  authenticate,
  aiCallActivityController.deleteAICallActivity
);

module.exports = router;