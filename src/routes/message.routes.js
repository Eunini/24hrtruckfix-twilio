const express = require("express");
const router = express.Router();
const twilioController = require("../controllers/message.controller");
const { authenticate } = require("../middleware/auth")

// router.post("/init-cache", twilioController.initCache);

// GET list of Twilio numbers
router.get("/twilio/numbers", authenticate, twilioController.listNumbers);

// GET grouped messages for a Twilio number (chats)
router.get("/twilio/messages", authenticate, twilioController.getMessagesGrouped);

// POST send a message
router.post("/twilio/messages/send", authenticate, twilioController.sendMessages);

// GET calls for a Twilio number
router.get("/twilio/calls", authenticate, twilioController.getCalls);

// create a token for user's browser to make calls
router.get("/token", twilioController.tokenController);


module.exports = router;