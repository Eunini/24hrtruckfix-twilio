const express = require("express");
const router = express.Router();
const messageController = require("../controllers/conversation.controller");
const { authenticate } = require("../middleware/auth");

// Send a message to mechanic
router.post("/messages/mechanic/send", authenticate, messageController.sendMechMessage);

// Send a message to driver
router.post("/messages/driver/send", authenticate, messageController.sendDriverMessage);

// Get mechanic conversation chat for a ticket
router.get("/messages/mechanic/:ticketId", authenticate, messageController.getMechMessagesByTicket);

// Get driver conversation chat for a ticket
router.get("/messages/driver/:ticketId", authenticate, messageController.getDriverMessagesByTicket);

// Twilio incoming webhook (no auth - Twilio posts here)
router.post("/messages/incoming", authenticate, messageController.statusCallback);

// Twilio status callback webhook (no auth - Twilio posts here)
router.post("/messages/status-callback", authenticate, messageController.markTicketMessagesRead);

module.exports = router;
