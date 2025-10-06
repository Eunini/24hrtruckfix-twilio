const express = require("express");
const router = express.Router();
const campaignTimerController = require("../controllers/campaign-timer.controller");
const { authenticate } = require("../middleware/auth");

/**
 * Campaign Timer Routes
 * Routes for handling campaign message timing with 10-minute gaps
 */

// Public endpoints (for cron jobs)
router.post(
  "/campaign-timer/process",
  campaignTimerController.processActiveCampaigns
);
router.get("/campaign-timer/health", campaignTimerController.healthCheck);

// Protected endpoints (require authentication)
router.post(
  "/campaign-timer/process/:campaignId",
  authenticate,
  campaignTimerController.processCampaign
);
router.get(
  "/campaign-timer/stats",
  authenticate,
  campaignTimerController.getTimerStats
);

module.exports = router;
