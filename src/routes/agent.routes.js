const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const agentController = require("../controllers/agent.controller");

// Apply authorization middleware to all routes
router.use(authenticate);

// Agent routes
router.post("/agent", agentController.createAgent);
router.get("/agents", agentController.getAllAgents);
router.get("/user-agents", agentController.getUserAgents);
router.get("/agents/:id", agentController.getAgentById);
router.put("/agents/:id", agentController.updateAgent);
router.delete("/agents/:id", agentController.deleteAgent);
router.patch("/agents/:id/status", agentController.changeAgentStatus);

module.exports = router;
