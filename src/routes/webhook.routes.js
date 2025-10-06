const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");
const cors = require("cors");
const { vapiCreateTicket } = require("../controllers/ticket.controller");
const {
  vapiValidatePolicy,
  vapiSendSms,
  vapiGetReverseGeocode,
} = require("../controllers/policy.controller");
const twilioController = require("../controllers/message.controller");
const validateTwilioWebhook = require("../middleware/validateTwilioWebhook");

/**
 * Webhook Routes for VAPI Integration
 * These routes match the original serverless function endpoints
 */

// Main webhook endpoints (matching original serverless routes)
router.post("/inbound-hook", webhookController.handleInboundHook);
router.post("/outbound-hook", webhookController.handleOutboundHook);
router.post("/marketing-inbound-hook", webhookController.handleMarketingHook);
router.post(
  "/marketing-outbound-hook",
  webhookController.handleMarketingOutboundHook
);
router.post(
  "/marketing-web-hook",
  webhookController.handleMarketingWebCallHook
);
router.post("/call-mechanics", webhookController.handleCallMechanicsHook); 

// Health check endpoint
router.get("/webhook/health", webhookController.healthCheck);

// VAPI create ticket endpoint - handles VAPI function calls
router.post("/webhook/create-ticket", vapiCreateTicket);

// Validate policy
router.post("/webhook/policies/validate", vapiValidatePolicy);
router.post("/webhook/send/sms", vapiSendSms);
router.post("/webhook/geocode/cordinate", vapiGetReverseGeocode);

// Knowledge base chat
router.post(
  "/webhook/knowledge-base/:organizationId/chat",
  webhookController.handleKnowledgeBaseChat
);

// Create web call
router.get("/webhook/create-call", cors(), webhookController.createWebCall);

// Create outbound call
router.post(
  "/webhook/create-outbound-call",
  cors(),
  webhookController.createOutboundCall
);

// Create demo outbound call
router.post(
  "/webhook/demo-outbound-call",
  cors(),
  webhookController.createDemoOutboundCall
);

router.post(
  "/calendar/action/:organizationId",
  cors(),
  webhookController.handleBookingAppointment
);

// POST webhook for incoming messages (Twilio sends x-www-form-urlencoded)
// router.post("/twilio/webhook/messages", cors(), twilioController.twilioIncomingWebhook);

// Twilio will POST form-encoded to this endpoint when browser initiates an outgoing call.
router.post("/twilio/voice", cors(), validateTwilioWebhook, twilioController.voiceWebhookController);

// POST webhook for incoming messages (Twilio sends x-www-form-urlencoded)
router.post("/twilio/webhook/messages", cors(), validateTwilioWebhook, twilioController.twilioIncomingWebhook);



module.exports = router;