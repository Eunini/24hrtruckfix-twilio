const express = require("express")
const router = express.Router()
const taskController = require("../controllers/task.controller")
const { authenticate } = require("../middleware/auth")

// Get all tasks with pagination and filters
router.get("/tasks", authenticate, taskController.getTasks)

// Create a new task
router.post("/tasks", authenticate, taskController.createTask)

router.post("/tasks/request", authenticate, taskController.requestAITask)

// Get tickets for a specific organization (for task creation dropdown)
router.get("/tasks/tickets/:organizationId", authenticate, taskController.getTicketsByOrganization)

// Change the status of a specific task
router.put("/tasks/:taskId/status", authenticate, taskController.changeTaskStatus)

// Mark a task as 'completed' (sets status and resolvedAt)
router.post("/tasks/:taskId/complete", authenticate, taskController.completeTask)

// Delete a task
router.delete("/tasks/:taskId", authenticate, taskController.deleteTask)

// mark task status false
router.put("/tasks/status/:ticket_id", authenticate, taskController.markNewRequestFalse)

module.exports = router