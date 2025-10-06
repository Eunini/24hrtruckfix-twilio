const express = require("express");
const router = express.Router();
const {
  getAllMechanicsController,
  createMechanicController,
  getMechanicByIdController,
  updateMechanicController,
  updateIsAcceptedController,
  deleteMechanicController,
  getAllMechanicsBasedOnOrganizationController,
  toggleBlacklistMechanicController,
  bulkDeleteMechanicsController,
  getCombinedMechanicsController,
  suggestMechanics,
  filterMechanics,
  getSelectedMechanicByIdController,
  findGoogleMapsProviders,
  createProviderFromGoogleMaps,
  getMechanicBlacklistOrgsController,
  blacklistMechanicGloballyController,
  unblacklistMechanicGloballyController,
  unblacklistMechanicForOrgController,
} = require("../controllers/mechanic.controller");

// Import bulk upload controller
const {
  bulkUploadMechanicsController,
  getJobStatusController,
} = require("../controllers/bulkUpload.controller");

// Authentication middleware
const { authenticate, requireOrganization } = require("../middleware/auth");

// Base path: /api/v1

// Get all mechanics
router.get(
  "/mechanics",
  authenticate,
  requireOrganization,
  getAllMechanicsController
);

router.get(
  "/mechanics/combined",
  authenticate,
  requireOrganization,
  getCombinedMechanicsController
);

// Create new mechanic
router.post(
  "/mechanic",
  authenticate,
  requireOrganization,
  createMechanicController
);

// Get mechanic by ID
router.get(
  "/mechanics/:mechanics",
  authenticate,
  requireOrganization,
  getMechanicByIdController
);

// Get SELECTED mechanic by ID
router.get(
  "/mechanics/selected/:mechanic",
  authenticate,
  requireOrganization,
  getSelectedMechanicByIdController
);

// Get mechanic by geoLocation
router.post(
  "/mechanics/suggest",
  authenticate,
  requireOrganization,
  suggestMechanics
);

// filter geoLocated mechanics
router.get("/mechanic", authenticate, requireOrganization, filterMechanics);

// Update mechanic
router.put(
  "/mechanics/update/:id",
  authenticate,
  requireOrganization,
  updateMechanicController
);

// Update mechanic acceptance status
router.put(
  "/mechanics/accept/:id",
  authenticate,
  requireOrganization,
  updateIsAcceptedController
);

// Blacklist mechanic
router.put(
  "/mechanics/blacklist/:id",
  authenticate,
  requireOrganization,
  toggleBlacklistMechanicController
);

// Get Orgs that blacklisted mechanic
router.get(
  "/mechanics/blacklisted/:id",
  authenticate,
  requireOrganization,
  getMechanicBlacklistOrgsController
);

// Global blacklist: admin or super_admin only
router.patch(
  '/mechanics/blacklist/global/:id',
  authenticate,
  requireOrganization,
  blacklistMechanicGloballyController
);

// Global unblacklist: admin or super_admin only
router.patch(
  '/mechanics/unblacklist/global/:id',
  authenticate,
  requireOrganization,
  unblacklistMechanicGloballyController
);

// unblacklist from org 
router.patch(
  '/mechanics/:id/unblacklist/:orgId',
  authenticate,
  requireOrganization,
  unblacklistMechanicForOrgController
);

// Delete mechanic
router.delete(
  "/mechanics/:id",
  authenticate,
  requireOrganization,
  deleteMechanicController
);

// Get all mechanics based on organization (updated route name for clarity)
router.get(
  "/mechanics/organization",
  authenticate,
  requireOrganization,
  getAllMechanicsBasedOnOrganizationController
);

// Alternative route for backward compatibility
router.get(
  "/mechanics/client",
  authenticate,
  requireOrganization,
  getAllMechanicsBasedOnOrganizationController
);

// Bulk delete mechanics
router.post(
  "/mechanics/bulkdelete",
  authenticate,
  requireOrganization,
  bulkDeleteMechanicsController
);

// Bulk upload mechanics (now using background queue)
router.post(
  "/mechanics/bulkupload",
  authenticate,
  requireOrganization,
  bulkUploadMechanicsController
);

// Job status route for mechanics bulk upload
router.get(
  "/mechanics/jobs/:queueName/:jobId/status",
  authenticate,
  requireOrganization,
  getJobStatusController
);

// New Google Maps endpoints
router.post(
  "/mechanics/find-google-maps",
  authenticate,
  requireOrganization,
  findGoogleMapsProviders
);
router.post(
  "/mechanics/create-from-google-maps",
  authenticate,
  requireOrganization,
  createProviderFromGoogleMaps
);

module.exports = router;
