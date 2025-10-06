const express = require("express");
const { body, param, query } = require("express-validator");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

// Validation middleware
const validateObjectId = (field) => {
  return param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);
};

const validatePaymentIntent = [
  body("ticketId")
    .isMongoId()
    .withMessage("Ticket ID must be a valid MongoDB ObjectId"),
  body("customerId")
    .isMongoId()
    .withMessage("Customer ID must be a valid MongoDB ObjectId"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
];

const validateRefund = [
  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be a positive number"),
  body("reason")
    .optional()
    .isIn(["duplicate", "fraudulent", "requested_by_customer", "other"])
    .withMessage("Invalid refund reason"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
];

const validateOnboardingLink = [
  body("refreshUrl")
    .optional()
    .isURL()
    .withMessage("Refresh URL must be a valid URL"),
  body("returnUrl")
    .optional()
    .isURL()
    .withMessage("Return URL must be a valid URL"),
];

// Stripe Connect Account Management Routes
/**
 * @route POST /api/v1/payments/connect/accounts/:organizationId
 * @desc Create Stripe Connect account for organization
 * @access Private
 */
router.post(
  "/connect/accounts/:organizationId",
  validateObjectId("organizationId"),
  paymentController.createConnectAccount
);

/**
 * @route POST /api/v1/payments/connect/accounts/:organizationId/onboarding-link
 * @desc Create onboarding link for organization
 * @access Private
 */
router.post(
  "/connect/accounts/:organizationId/onboarding-link",
  validateObjectId("organizationId"),
  validateOnboardingLink,
  paymentController.createOnboardingLink
);

/**
 * @route GET /api/v1/payments/connect/accounts/:organizationId/status
 * @desc Get Stripe Connect account status
 * @access Private
 */
router.get(
  "/connect/accounts/:organizationId/status",
  validateObjectId("organizationId"),
  paymentController.getAccountStatus
);

/**
 * @route POST /api/v1/payments/connect/accounts/:organizationId/login-link
 * @desc Create dashboard login link for organization
 * @access Private
 */
router.post(
  "/connect/accounts/:organizationId/login-link",
  validateObjectId("organizationId"),
  paymentController.createLoginLink
);

// Stripe OAuth Routes
/**
 * @route GET /api/v1/payments/connect/oauth/:organizationId
 * @desc Get Stripe OAuth URL for organization
 * @access Private
 */
router.get(
  "/connect/oauth/:organizationId",
  validateObjectId("organizationId"),
  paymentController.getStripeOAuthURL
);

/**
 * @route GET /api/v1/payments/connect/callback
 * @desc Handle Stripe OAuth callback
 * @access Public
 */
router.get("/connect/callback", paymentController.handleStripeCallback);

// Payment Processing Routes
/**
 * @route POST /api/v1/payments/intents
 * @desc Create payment intent for a service
 * @access Private
 */
router.post(
  "/intents",
  validatePaymentIntent,
  paymentController.createPaymentIntent
);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc Get payment details
 * @access Private
 */
router.get(
  "/:paymentId",
  validateObjectId("paymentId"),
  paymentController.getPayment
);

/**
 * @route GET /api/v1/payments/mechanics/:mechanicId
 * @desc List payments for a mechanic
 * @access Private
 */
router.get(
  "/mechanics/:mechanicId",
  validateObjectId("mechanicId"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn([
        "pending",
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
        "processing",
        "succeeded",
        "canceled",
        "failed",
      ])
      .withMessage("Invalid payment status"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Date from must be a valid ISO date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Date to must be a valid ISO date"),
  ],
  paymentController.listMechanicPayments
);

/**
 * @route POST /api/v1/payments/:paymentId/refund
 * @desc Process refund for a payment
 * @access Private
 */
router.post(
  "/:paymentId/refund",
  validateObjectId("paymentId"),
  validateRefund,
  paymentController.processRefund
);

// Analytics Routes
/**
 * @route GET /api/v1/payments/analytics/revenue
 * @desc Get revenue statistics
 * @access Private
 */
router.get(
  "/analytics/revenue",
  [
    query("organizationId")
      .optional()
      .isMongoId()
      .withMessage("Organization ID must be a valid MongoDB ObjectId"),
    query("mechanicId")
      .optional()
      .isMongoId()
      .withMessage("Mechanic ID must be a valid MongoDB ObjectId"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Date from must be a valid ISO date"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Date to must be a valid ISO date"),
  ],
  paymentController.getRevenueStats
);

// Webhook Routes
/**
 * @route POST /api/v1/payments/webhooks/stripe
 * @desc Handle Stripe webhooks
 * @access Public (Stripe only)
 */
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

module.exports = router;
