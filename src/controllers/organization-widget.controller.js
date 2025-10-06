const {
  organizationWidgetService,
} = require("../services/organization-widget.service");
const mongoose = require("mongoose");

const createOrganizationWidget = async (req, res) => {
  try {
    const { config, allowedOrigins, widgetType } = req.body;
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Configuration is required",
      });
    }

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    const result = await organizationWidgetService.createWidget({
      organizationId,
      config,
      allowedOrigins,
      widgetType,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Organization widget created successfully",
    });
  } catch (error) {
    console.error("Error creating organization widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create organization widget",
    });
  }
};

const updateOrganizationWidget = async (req, res) => {
  try {
    const { id } = req.params;
    const { config, allowedOrigins, settings, isActive } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    if (!config && !allowedOrigins && !settings && isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field to update is required",
      });
    }

    const result = await organizationWidgetService.updateWidget({
      widgetId: id,
      config,
      allowedOrigins,
      settings,
      isActive,
      user: req.user,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Organization widget updated successfully",
    });
  } catch (error) {
    console.error("Error updating organization widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update organization widget",
    });
  }
};

const deleteOrganizationWidget = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const result = await organizationWidgetService.deleteWidget(id);

    res.status(200).json({
      success: true,
      message: "Organization widget deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organization widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete organization widget",
    });
  }
};

const getOrganizationWidgetById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const result = await organizationWidgetService.getWidgetById(
      new mongoose.Types.ObjectId(id)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving organization widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve organization widget",
    });
  }
};

const getOrganizationWidgetByOrganizationId = async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    const result = await organizationWidgetService.getWidgetByOrganizationId(
      organizationId
    );

    if (result === null) {
      return res.status(200).json({
        success: false,
        message: "Widget not found for the specified organization",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Error retrieving organization widget by organization:",
      error
    );
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve organization widget",
    });
  }
};

const getOrganizationWidgetByOrganizationIdWithoutPerms = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    const result =
      await organizationWidgetService.getWidgetByOrganizationIdWithoutPerms(
        organizationId
      );

    if (result === null) {
      return res.status(200).json({
        success: false,
        message: "Widget not found for the specified organization",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Error retrieving organization widget by organization:",
      error
    );
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve organization widget",
    });
  }
};

const toggleOrganizationWidgetStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const result = await organizationWidgetService.toggleWidgetStatus(id);

    res.status(200).json({
      success: true,
      data: result,
      message: `Organization widget ${
        result.isActive ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (error) {
    console.error("Error toggling organization widget status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle organization widget status",
    });
  }
};

const getOrganizationWidgetAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const dateRange = { startDate, endDate };
    const result = await organizationWidgetService.getWidgetAnalytics(
      id,
      dateRange
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving organization widget analytics:", error);
    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to retrieve organization widget analytics",
    });
  }
};

module.exports = {
  createOrganizationWidget,
  updateOrganizationWidget,
  deleteOrganizationWidget,
  getOrganizationWidgetById,
  getOrganizationWidgetByOrganizationId,
  getOrganizationWidgetByOrganizationIdWithoutPerms,
  toggleOrganizationWidgetStatus,
  getOrganizationWidgetAnalytics,
};
