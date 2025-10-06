const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getSystemStatus,
  toggleSystemActive,
  toggleSystemLiveMode,
} = require("../controllers/systemStatus.controller");

router.get("/system/status", authenticate, getSystemStatus);
router.post("/system/active", authenticate, toggleSystemActive);
router.post("/system/live", authenticate, toggleSystemLiveMode);

module.exports = router;
