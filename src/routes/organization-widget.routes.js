const express = require("express");
const {
  createOrganizationWidget,
  updateOrganizationWidget,
  deleteOrganizationWidget,
  getOrganizationWidgetById,
  getOrganizationWidgetByOrganizationId,
  getOrganizationWidgetByOrganizationIdWithoutPerms,
  toggleOrganizationWidgetStatus,
  getOrganizationWidgetAnalytics,
} = require("../controllers/organization-widget.controller");
const cors = require("cors");
const { authenticate } = require("../middleware/auth");

const organizationWidgetRouter = express.Router();

/**
 * @route GET /api/v1/organization-widgets/organization?organizationId=:organizationId
 * @desc Get a widget by organization ID
 * @access Private
 */
organizationWidgetRouter.get(
  "/organization",
  authenticate,
  getOrganizationWidgetByOrganizationId
);

/**
 * @route POST /api/v1/organization-widgets?organizationId=:organizationId
 * @desc Create a new organization widget
 * @access Private
 */
organizationWidgetRouter.post("", authenticate, createOrganizationWidget);

/**
 * @route PUT /api/v1/organization-widgets/:id
 * @desc Update an existing organization widget
 * @access Private
 */
organizationWidgetRouter.put("/:id", authenticate, updateOrganizationWidget);

/**
 * @route DELETE /api/v1/organization-widgets/:id
 * @desc Delete an organization widget
 * @access Private
 */
organizationWidgetRouter.delete("/:id", authenticate, deleteOrganizationWidget);

/**
 * @route GET /api/v1/organization-widgets/:id
 * @desc Get an organization widget by ID
 * @access Private
 */
organizationWidgetRouter.get(
  "/:id",
  cors({ origin: "*" }),
  getOrganizationWidgetById
);

/**
 * @route GET /api/v1/organization-widgets/organization/:organizationId/open
 * @desc Get an organization widget by Organization ID Without Permissions (Public)
 * @access Public
 */
organizationWidgetRouter.get(
  "/organization/:organizationId/open",
  getOrganizationWidgetByOrganizationIdWithoutPerms
);

/**
 * @route PATCH /api/v1/organization-widgets/:id/toggle
 * @desc Toggle organization widget active status
 * @access Private
 */
organizationWidgetRouter.patch(
  "/:id/toggle",
  authenticate,
  toggleOrganizationWidgetStatus
);

/**
 * @route GET /api/v1/organization-widgets/:id/analytics
 * @desc Get organization widget analytics
 * @access Private
 */
organizationWidgetRouter.get(
  "/:id/analytics",
  authenticate,
  getOrganizationWidgetAnalytics
);

module.exports = organizationWidgetRouter;
