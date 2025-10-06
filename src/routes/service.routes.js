const express = require("express");
const router = express.Router();
const { authenticate, requireOrganization } = require("../middleware/auth");
const serviceController = require("../controllers/service.controller");

// Service CRUD routes
router.post(
  "/services",
  authenticate,
  requireOrganization,
  serviceController.createService
);

router.get(
  "/services",
  authenticate,
  requireOrganization,
  serviceController.getServices
);

router.get(
  "/services/:id",
  authenticate,
  requireOrganization,
  serviceController.getServiceById
);

router.put(
  "/services/:id",
  authenticate,
  requireOrganization,
  serviceController.updateService
);

router.delete(
  "/services/:id",
  authenticate,
  requireOrganization,
  serviceController.deleteService
);

// State management routes
router.post(
  "/services/:id/states",
  authenticate,
  requireOrganization,
  serviceController.addStateToService
);

router.put(
  "/services/:id/states/:state",
  authenticate,
  requireOrganization,
  serviceController.updateStateInService
);

router.delete(
  "/services/:id/states/:state",
  authenticate,
  requireOrganization,
  serviceController.deleteStateFromService
);

// Weight classification management routes
router.post(
  "/services/:id/weight-classifications",
  authenticate,
  requireOrganization,
  serviceController.addWeightClassificationToService
);

router.put(
  "/services/:id/weight-classifications/:classification",
  authenticate,
  requireOrganization,
  serviceController.updateWeightClassificationInService
);

router.delete(
  "/services/:id/weight-classifications/:classification",
  authenticate,
  requireOrganization,
  serviceController.deleteWeightClassificationFromService
);

// Service pricing calculation route
router.post(
  "/services/calculate-pricing",
  authenticate,
  serviceController.calculateServicePricing
);

// AI-powered service pricing calculation route
router.post(
  "/services/ai-calculate-pricing",
  authenticate,
  requireOrganization,
  serviceController.aICalculateServicePricing
);

module.exports = router;
