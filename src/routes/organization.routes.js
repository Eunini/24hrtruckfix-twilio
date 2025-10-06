const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const organizationController = require("../controllers/organization.controller");

// Organization routes
router.get(
  "/organizations",
  authenticate,
  organizationController.getOrganizations
);
router.post(
  "/organizations",
  authenticate,
  organizationController.createOrganization
);
router.get(
  "/organizations/:orgId/driver",
  authenticate,
  organizationController.getOrgDriver
);
router.put(
  "/organizations/:orgId/driver",
  authenticate,
  organizationController.updateOrgDriver
);
router.get(
  "/organizations/driver/:urlPath",
  organizationController.getOrgDriverReferralPath
);
router.put(
  "/organizations/:orgId/driver/referral",
  authenticate,
  organizationController.updateOrgDriverReferralPath
);
router.post(
  "/organizations/admin",
  authenticate,
  organizationController.createOrganByAdmin
);
router.post(
  "/organizations/:orgId/enable-marketing",
  authenticate,
  organizationController.enableMarketing
);
router.get(
  "/organizations/:orgId/check-marketing",
  authenticate,
  organizationController.checkMarketing
);
router.get(
  "/organizations/:id",
  authenticate,
  organizationController.getSingleOrganization
);
router.get(
  "/organizations/:id/ai-status",
  authenticate,
  organizationController.getOrganizationWithAIStatus
);
router.put(
  "/organizations/:id",
  authenticate,
  organizationController.updateOrganization
);
router.post(
  "/organizations/logo",
  authenticate,
  organizationController.orgUploadImage
);
router.get(
  "/organizations/:id/logo",
  authenticate,
  organizationController.getOrgImage
);
router.delete(
  "/organizations/:id",
  authenticate,
  organizationController.deleteOrganization
);

// Organization member management
router.post(
  "/organizations/:id/members",
  authenticate,
  organizationController.addMemberToOrganization
);
router.delete(
  "/organizations/:id/members/:userId",
  authenticate,
  organizationController.removeMemberFromOrganization
);

// Organization verification and AI setup
router.post(
  "/organizations/:id/verify",
  authenticate,
  organizationController.verifyOrganization
);
router.post(
  "/organizations/:id/retry-ai-setup",
  authenticate,
  organizationController.retryAISetup
);
router.delete(
  "/organizations/:id/ai-setup",
  authenticate,
  organizationController.cleanupAISetup
);

// Organization owner lookup
router.get(
  "/organizations/owner/:ownerId",
  authenticate,
  organizationController.getOrgByOwnerId
);

// Organization by policy lookup
router.get(
  "/organizations/policy/:policy",
  authenticate,
  organizationController.getOrgByPolicy
);

// Policy upsert management
router.get(
  "/organizations/:id/upsert-policies",
  authenticate,
  organizationController.getShouldUpsertPolicies
);
router.put(
  "/organizations/:id/upsert-policies",
  authenticate,
  organizationController.setShouldUpsertPolicies
);
router.put(
  "/organizations/bulk/upsert-policies",
  authenticate,
  organizationController.bulkSetShouldUpsertPolicies
);

// Driver portal routes
router.post(
  "/organizations/:orgId/driver-portal",
  authenticate,
  organizationController.setUpDriverPortal
);

router.get(
  "/organizations/driver-portal/verify/:urlSlug",
  organizationController.verifyOrganizationUrlSlug
);

module.exports = router;
