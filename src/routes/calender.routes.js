const express = require("express");
const {
  getCalendarConnection,
  deleteCalendarConnection,
  testConnection,
  saveCalendarOfChoice,
} = require("../controllers/calender.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Get calendar connection for a organization
router.get("/connection", authenticate, getCalendarConnection);

// Delete calendar connection for a organization
router.delete("/connection", authenticate, deleteCalendarConnection);

// Test calendar connection
router.get("/test/connection", authenticate, testConnection);

router.post("/calenderId/", authenticate, saveCalendarOfChoice);

module.exports = router;
