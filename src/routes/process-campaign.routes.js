const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const processCampaignController = require("../controllers/process-campaign.controller");

// Apply authorization middleware
// router.use(authenticate);

// CAMPAIGN PROCESSING ROUTES

/**
 * @route POST /api/v1/process-campaign/:campaignId
 * @desc Process entire campaign - send messages to all active leads
 * @access Private
 */
router.post(
  "/process-campaign/:campaignId",
  processCampaignController.processCampaign
);

/**
 * @route POST /api/v1/process-lead/:leadId
 * @desc Process a single lead - send next message
 * @access Private
 */
router.post("/process-lead/:leadId", processCampaignController.processLead);

/**
 * @route GET /api/v1/campaign-status/:campaignId
 * @desc Check if campaign is active
 * @access Private
 */
router.get(
  "/campaign-status/:campaignId",
  processCampaignController.checkCampaignStatus
);

/**
 * @route GET /api/v1/campaign-active-leads/:campaignId
 * @desc Get all active leads for a campaign
 * @access Private
 */
router.get(
  "/campaign-active-leads/:campaignId",
  processCampaignController.getActiveCampaignLeads
);

module.exports = router;
