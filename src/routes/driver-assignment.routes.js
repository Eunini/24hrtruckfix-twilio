const express = require('express');
const router = express.Router();
const driverAssignmentController = require('../controllers/driver-assignment.controller');
const { authenticate } = require('../middleware/auth');

// Routes for driver assignment
router.post('/tickets/:ticketId/assign', authenticate, driverAssignmentController.assignDriverToTicket);
router.post('/tickets/:ticketId/unassign', authenticate, driverAssignmentController.unassignDriverFromTicket);
router.get('/tickets/:ticketId/assignment', authenticate, driverAssignmentController.getAssignmentStatus);

module.exports = router;