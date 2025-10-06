const express = require("express");
const {
  createChatThread,
  getChatThreads,
  getChatThread,
  getChatMessages,
  deleteChatThread,
  sendMessage,
} = require("../controllers/chat.controller");
const cors = require("cors");
const { authenticate } = require("../middleware/auth");

const chatRouter = express.Router();

/**
 * @route POST /api/v0/chat/threads
 * @desc Create a new chat thread for a mechanic or organization
 * @body {mechanicId, organizationId, title, initialMessage, isOrg}
 * @body mechanicId - Required for mechanic chats (when isOrg=false)
 * @body organizationId - Required for organization chats (when isOrg=true)
 * @body title - Chat thread title
 * @body initialMessage - First message in the chat
 * @body isOrg - Boolean flag to indicate organization chat (default: false)
 * @access Public
 */
chatRouter.post("/threads", createChatThread);

/**
 * @route GET /api/v0/chat/threads
 * @desc Get all chat threads for the user (optionally filtered by mechanicId or organizationId)
 * @query mechanicId - Optional mechanic ID to filter threads (when isOrg=false)
 * @query organizationId - Optional organization ID to filter threads (when isOrg=true)
 * @query isOrg - Boolean flag to indicate organization chat threads (default: false)
 * @access Private
 */
chatRouter.get("/threads", authenticate, getChatThreads);

/**
 * @route GET /api/v0/chat/threads/:id
 * @desc Get a chat thread by ID
 * @access Private
 */
chatRouter.get("/threads/:id", authenticate, getChatThread);

/**
 * @route DELETE /api/v0/chat/threads/:id
 * @desc Delete a chat thread
 * @access Private
 */
chatRouter.delete("/threads/:id", authenticate, deleteChatThread);

/**
 * @route GET /api/v0/chat/threads/:threadId/messages
 * @desc Get messages for a chat thread
 * @access Private
 */
chatRouter.get(
  "/threads/:threadId/messages/all",
  authenticate,
  getChatMessages
);
chatRouter.get(
  "/threads/:threadId/messages",
  cors({ origin: "*" }),
  getChatMessages
);

/**
 * @route POST /api/v0/chat/threads/:threadId/messages
 * @desc Send a message to a chat thread
 * @access Private
 * @query stream - Set to 'true' for streaming response
 */
chatRouter.post("/threads/:threadId/messages", sendMessage);

module.exports = chatRouter;
