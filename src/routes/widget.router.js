const express = require("express");
const {
  createWidget,
  updateWidget,
  deleteWidget,
  getWidgetById,
  getWidgetByMechanicId,
  getWidgetByMechanicIdWithoutPerms,
} = require("../controllers/widget.controller");
const cors = require("cors");
const { authenticate } = require("../middleware/auth");

const widgetRouter = express.Router();

/**

* @route GET /api/v0/widgets/mechanic?mechanicId=:mechanicId
* @desc Get a widget by mechanic ID
* @access Private
*/
widgetRouter.get("/mechanic", authenticate, getWidgetByMechanicId);

/**
 * @route POST /api/v0/widgets?mechanicId=:mechanicId
 * @desc Create a new widget
 * @access Private
 */
widgetRouter.post("", authenticate, createWidget);

/**
 * @route PUT /api/v0/widgets/:id
 * @desc Update an existing widget
 * @access Private
 */
widgetRouter.put("/:id", authenticate, updateWidget);

/**
 * @route DELETE /api/v0/widgets/:id
 * @desc Delete a widget
 * @access Private
 */
widgetRouter.delete("/:id", authenticate, deleteWidget);

/**
 * @route GET /api/v0/widgets/:id
 * @desc Get a widget by ID
 * @access Private
 */
widgetRouter.get("/:id", cors({ origin: "*" }), getWidgetById);

/**
 * @route GET /api/v0/widgets/mechanic/:mechanicId/open
 * @desc Get a widget by Mechanic ID Without Permissions
 * @access Public
 */
widgetRouter.get(
  "/mechanic/:mechanicId/open",
  getWidgetByMechanicIdWithoutPerms
);

module.exports = widgetRouter;
