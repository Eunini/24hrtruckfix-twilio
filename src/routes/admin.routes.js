const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const adminController = require("../controllers/admin.controller");

// Apply authorization middleware
router.use(authenticate);

// Admin routes
router.post("/admin/api/v1/add/policy", adminController.createAdminPolicy);
router.put(
  "/admin/api/v1/update/policy/:id",
  adminController.updateAdminPolicy
);
router.get("/admin/api/v1/get/policy/:id", adminController.getAdminPolicy);
router.get(
  "/admin/api/v1/search/policy/:search_str",
  adminController.searchAdminPolicyByNameAndNumber
);
router.get("/admin/api/v1/all/policies", adminController.getAllAdminPolicies);
router.get("/admin/api/v1/policies/all", adminController.getAllPolicies);
router.get("/admin/api/v1/analysis", adminController.getAnalysis);

module.exports = router;
