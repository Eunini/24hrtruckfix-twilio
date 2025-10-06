const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const cronJobController = require("../controllers/cronJob.controller");

/**
 * Cron Job Routes for Scheduled Task Management
 * These routes replace serverless cron jobs with API endpoints
 */

// Main cron job endpoints (protected with authentication)
router.post("/cron/process-batches", cronJobController.processBatches);
router.get("/cron/stats", authenticate, cronJobController.getStats);
router.post("/cron/cleanup", authenticate, cronJobController.cleanupExpired);
router.post(
  "/cron/process-ticket/:ticketId",
  authenticate,
  cronJobController.processSpecificTicket
);
router.post(
  "/cron/maintenance",
  authenticate,
  cronJobController.runMaintenance
);

// Health check and configuration (no auth needed for monitoring)
router.get("/cron/health", cronJobController.healthCheck);
router.get("/cron/schedule-config", cronJobController.getScheduleConfig);

module.exports = router;
