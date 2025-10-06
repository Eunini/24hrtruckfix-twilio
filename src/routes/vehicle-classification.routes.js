const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const vehicleClassificationController = require("../controllers/vehicle-classification.controller");

// Vehicle classification routes

// Upsert vehicle classification (create or update) - can be system default or organization specific
router.post(
  "/vehicle-classifications",
  authenticate,
  vehicleClassificationController.upsertVehicleClassification
);

// Get all vehicle classifications
router.get(
  "/vehicle-classifications",
  authenticate,
  vehicleClassificationController.getAllVehicleClassifications
);

// Get system default vehicle classification
router.get(
  "/vehicle-classifications/system-default",
  authenticate,
  vehicleClassificationController.getSystemDefaultVehicleClassification
);

// Get vehicle classification by organization (falls back to system default)
router.get(
  "/vehicle-classifications/organization/:organizationId",
  authenticate,
  vehicleClassificationController.getVehicleClassificationByOrganization
);

// Delete vehicle classification (can be system default or organization specific)
router.delete(
  "/vehicle-classifications/:organizationId?",
  authenticate,
  vehicleClassificationController.deleteVehicleClassification
);

// State management routes for vehicle classification (can be system default or organization specific)

// Add state to system default vehicle classification
router.post(
  "/vehicle-classifications/system-default/states",
  authenticate,
  vehicleClassificationController.addStateToVehicleClassification
);

// Add state to organization vehicle classification
router.post(
  "/vehicle-classifications/:organizationId/states",
  authenticate,
  vehicleClassificationController.addStateToVehicleClassification
);

// Update state in system default vehicle classification
router.put(
  "/vehicle-classifications/system-default/states/:state",
  authenticate,
  vehicleClassificationController.updateStateInVehicleClassification
);

// Update state in organization vehicle classification
router.put(
  "/vehicle-classifications/:organizationId/states/:state",
  authenticate,
  vehicleClassificationController.updateStateInVehicleClassification
);

// Delete state from system default vehicle classification
router.delete(
  "/vehicle-classifications/system-default/states/:state",
  authenticate,
  vehicleClassificationController.deleteStateFromVehicleClassification
);

// Delete state from organization vehicle classification
router.delete(
  "/vehicle-classifications/:organizationId/states/:state",
  authenticate,
  vehicleClassificationController.deleteStateFromVehicleClassification
);

module.exports = router;
