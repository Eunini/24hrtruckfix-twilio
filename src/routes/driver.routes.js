const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const {
  authenticateDriver,
  authenticateRegistrationToken,
  blockRegistrationToken,
  allowBothTokens,
} = require("../middleware/driver.auth");
const { upload } = require("../services/file-upload.service");

// Public routes (no authentication required)
router.post("/drivers/register", driverController.registerDriver);
router.post("/drivers/login", driverController.loginDriver);
router.post("/drivers/reset", driverController.resetPass);
router.post("/drivers/verify", driverController.verifyOtp);
router.post("/drivers/change", driverController.changePass);

// Public route to get organization info by slug (for registration page)
router.get(
  "/drivers/organizations/:slug/info",
  driverController.getOrganizationInfoBySlug
);

// Registration token protected routes (requires registration token)
router.post(
  "/drivers/complete-registration",
  authenticateRegistrationToken,
  driverController.completeRegistration
);

// Update registration details (requires registration token)
router.put(
  "/drivers/registration/update",
  authenticateRegistrationToken,
  driverController.updateRegistrationDetails
);

// OTP routes (require registration token)
router.post(
  "/drivers/send-otp",
  authenticateRegistrationToken,
  driverController.sendOTP
);

router.post(
  "/drivers/verify-otp",
  authenticateRegistrationToken,
  driverController.verifyOTP
);

// Routes that accept both registration and regular tokens
router.post(
  "/drivers/:driverId/verify",
  allowBothTokens,
  driverController.submitVerification
);

// Get driver verification documents
router.get(
  "/drivers/:driverId/verification/documents",
  allowBothTokens,
  driverController.getVerificationDocuments
);

// Get driver verification status
router.get(
  "/drivers/:driverId/verification/status",
  allowBothTokens,
  driverController.getVerificationStatus
);

// Get organization info (authenticated - works with both token types)
router.get(
  "/drivers/organization",
  allowBothTokens,
  driverController.getOrganizationInfo
);

// Payment routes (work with both token types for payment info, require regular token for payment processing)
router.get(
  "/drivers/payment/info",
  allowBothTokens,
  driverController.getDriverPaymentInfo
);

router.post(
  "/drivers/payment/create",
  blockRegistrationToken,
  authenticateDriver,
  driverController.createDriverPayment
);

router.get(
  "/drivers/payment/history",
  blockRegistrationToken,
  authenticateDriver,
  driverController.getDriverPaymentHistory
);

// Add payment method for driver
router.post(
  "/drivers/payment/add-method",
  allowBothTokens,
  driverController.addPaymentMethod
);

// Create subscription to organization
router.post(
  "/drivers/subscription/create",
  allowBothTokens,
  driverController.createSubscription
);

// Get driver's payment methods
router.get(
  "/drivers/payment/methods",
  allowBothTokens,
  driverController.getPaymentMethods
);

// Get driver's subscription status
router.get(
  "/drivers/subscription/status",
  blockRegistrationToken,
  authenticateDriver,
  driverController.getSubscriptionStatus
);

// Cancel driver's subscription
router.post(
  "/drivers/subscription/cancel",
  blockRegistrationToken,
  authenticateDriver,
  driverController.cancelSubscription
);

// Handle checkout session success
router.get(
  "/drivers/checkout/success",
  allowBothTokens,
  driverController.handleCheckoutSuccess
);

// Get driver onboarding status and progress
router.get(
  "/drivers/onboarding/status",
  allowBothTokens,
  driverController.getOnboardingStatus
);

// Regular driver protected routes (requires regular token, blocks registration tokens)
router.get(
  "/drivers/profile",
  allowBothTokens,
  driverController.getDriverProfile
);

// Update driver profile
router.put(
  "/drivers/profile",
  authenticateDriver,
  driverController.updateDriverProfile
);

// het driver notification settings
router.get("/drivers/settings", allowBothTokens, driverController.getSettings);

// Update driver notification settingsc
router.put(
  "/drivers/settings",
  authenticateDriver,
  driverController.updateSettings
);

module.exports = router;
