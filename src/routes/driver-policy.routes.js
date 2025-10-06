const express = require("express");
const router = express.Router();
const driverPolicyController = require("../controllers/driver-policy.controller");
const { authenticateDriver } = require("../middleware/driver.auth");

// All routes require driver authentication
router.use(authenticateDriver);

// Policy routes (driver can only access their own policy)
router.get("/policy", driverPolicyController.getDriverPolicy);

// Vehicle management routes (using driver's phone as policy number internally)
router.post("/vehicles", driverPolicyController.addVehicleToPolicy);
router.put(
  "/vehicles/:vehicle_vin",
  driverPolicyController.updateVehicleInPolicy
);
router.delete(
  "/vehicles/:vehicle_vin",
  driverPolicyController.removeVehicleFromPolicy
);

// Warranty management routes
router.post(
  "/vehicles/:vehicle_vin/warranties",
  driverPolicyController.addWarrantyToVehicle
);

module.exports = router;
