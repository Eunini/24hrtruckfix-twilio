const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const mechanicDetailsController = require("../controllers/mechanic-details.controller");

// Mechanic details routes

// Create new mechanic details
router.post(
  "/mechanic-details",
  authenticate,
  mechanicDetailsController.createMechanicDetails
);

// Get all mechanic details (admin view)
router.get(
  "/mechanic-details",
  authenticate,
  mechanicDetailsController.getAllMechanicDetails
);

// Get all details for a specific mechanic
router.get(
  "/mechanic-details/mechanic/:mechanicId",
  authenticate,
  mechanicDetailsController.getMechanicDetailsByMechanicId
);

// Get a single mechanic detail by ID
router.get(
  "/mechanic-details/:detailId",
  authenticate,
  mechanicDetailsController.getMechanicDetailById
);

// Update mechanic details
router.put(
  "/mechanic-details/:detailId",
  authenticate,
  mechanicDetailsController.updateMechanicDetails
);

// Delete mechanic details
router.delete(
  "/mechanic-details/:detailId",
  authenticate,
  mechanicDetailsController.deleteMechanicDetails
);

module.exports = router;
