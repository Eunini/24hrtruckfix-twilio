const express = require("express");
const router = express.Router();
const { authenticate, requireOrganization } = require("../middleware/auth");
const policyController = require("../controllers/policy.controller");

// Import bulk upload controller
const {
  bulkUploadPoliciesController,
  getJobStatusController,
} = require("../controllers/bulkUpload.controller");

// Get all policies with pagination
router.get(
  "/policies",
  authenticate,
  requireOrganization,
  policyController.getPolicies
);

// Get all org policies with pagination for agent
router.get(
  "/policies/combined",
  authenticate,
  requireOrganization,
  policyController.getCombinedPolicies
);

// Get admin policies
router.get("/admin/policies", authenticate, policyController.getAdminPolicies);

// Search policies
router.get(
  "/policy/search/:searchTerm",
  authenticate,
  requireOrganization,
  policyController.searchPolicyByNameAndNumber
);

// Get recent policies
router.get(
  "/policies/recent",
  authenticate,
  requireOrganization,
  policyController.getRecentPolicies
);

// Get policy by number
router.get(
  "/policies/number/:policy_number",
  authenticate,
  requireOrganization,
  policyController.getPolicyByNumber
);

// Get policies by client ID
router.get(
  "/policies/client",
  authenticate,
  requireOrganization,
  policyController.getPolicyByClientId
);

// Validate policy
router.post("/policies/validate", policyController.vapiValidatePolicy);

// Get policy by ID
router.get(
  "/policies/:id",
  authenticate,
  requireOrganization,
  policyController.getPolicyById
);

// Create new policy
router.post(
  "/policy",
  authenticate,
  requireOrganization,
  policyController.createNewPolicy
);

// Update policy
router.put(
  "/policy/update/:id",
  authenticate,
  requireOrganization,
  policyController.updatePolicy
);

// Delete policy
router.delete(
  "/policies/:id",
  authenticate,
  requireOrganization,
  policyController.deletePolicy
);

// Bulk upload policies (now using background queue)
router.post(
  "/policies/bulk",
  authenticate,
  requireOrganization,
  bulkUploadPoliciesController
);

// Legacy bulk upload route for backward compatibility
router.post(
  "/policies/bulkupload",
  authenticate,
  requireOrganization,
  bulkUploadPoliciesController
);

// Job status route for policies bulk upload
router.get(
  "/policies/jobs/:queueName/:jobId/status",
  authenticate,
  requireOrganization,
  getJobStatusController
);

// Search policy by name and number
router.get(
  "/policies/search/:searchTerm",
  authenticate,
  requireOrganization,
  policyController.searchPolicyByNameAndNumber
);

module.exports = router;
