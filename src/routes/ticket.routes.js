const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticket.controller");
const aiActivityController = require("../controllers/aiActivity.controller");
const { authenticate } = require("../middleware/auth");

// Get all tickets with pagination and filters
router.get("/tickets", authenticate, ticketController.getTickets);

// Get all org tickets with pagination and filters
router.get(
  "/tickets/combined",
  authenticate,
  ticketController.getCombinedTickets
);

// Get all tickets logs
router.get("/ticket/logs", aiActivityController.getTicketLogs);

// Create new ticket
router.post("/tickets", authenticate, ticketController.createNewTicket);

// Get tickets coords
router.post("/tickets/geolocate", authenticate, ticketController.geoLocateTicket);

// Get ticket by ID
router.get("/tickets/:id", authenticate, ticketController.getTicketById);

// Update ticket
router.put("/tickets/:id", authenticate, ticketController.updateTicket);

// Update ticket mechanic
router.put("/accept/:id", authenticate, ticketController.approveRequest);

router.put("/reject/:id", authenticate, ticketController.declineRequest);

// Get ticket terms
router.get("/ticket-terms", authenticate, ticketController.getTicketTerms);

// Update ticket terms
router.put("/ticket-terms", authenticate, ticketController.updateTicketTerms);

// Delete ticket
router.delete("/tickets/:id", authenticate, ticketController.deleteTicket);

// Get ticket statistics
router.get("/tickets/stats", authenticate, ticketController.getTicketStats);

// Specialized ticket routes
router.put(
  "/tickets/:id/location",
  authenticate,
  ticketController.updateTicketLocation
);
router.post(
  "/tickets/:id/repair-request",
  authenticate,
  ticketController.sendRepairRequest
);
router.post(
  "/tickets/:ticketId/assign-provider",
  authenticate,
  ticketController.assignProviderToTicket
);
router.post("/tickets/ai", authenticate, ticketController.aiCreateTicket);

// Statistics and active tickets
router.get("/tickets/active", authenticate, ticketController.getActiveTickets);

module.exports = router;
