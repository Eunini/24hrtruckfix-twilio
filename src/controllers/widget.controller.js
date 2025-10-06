const { widgetService } = require("../services/widget.service");
const mongoose = require("mongoose");

const createWidget = async (req, res) => {
  try {
    const { config, allowedOrigins } = req.body;
    const { mechanicId } = req.query;

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: "Mechanic ID is required",
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Configuration is required",
      });
    }

    const result = await widgetService.createWidget({
      mechanicId,
      config,
      allowedOrigins,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Widget created successfully",
    });
  } catch (error) {
    console.error("Error creating widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create widget",
    });
  }
};

const updateWidget = async (req, res) => {
  try {
    const { id } = req.params;
    const { config, allowedOrigins } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    if (!config && !allowedOrigins) {
      return res.status(400).json({
        success: false,
        message: "At least one field to update is required",
      });
    }

    const result = await widgetService.updateWidget({
      widgetId: id,
      config,
      allowedOrigins,
      user: req.user,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Widget updated successfully",
    });
  } catch (error) {
    console.error("Error updating widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update widget",
    });
  }
};

const deleteWidget = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const result = await widgetService.deleteWidget(id);

    res.status(200).json({
      success: true,
      message: "Widget deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete widget",
    });
  }
};

const getWidgetById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid widget ID format",
      });
    }

    const result = await widgetService.getWidgetById(
      new mongoose.Types.ObjectId(id)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving widget:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve widget",
    });
  }
};

const getWidgetByMechanicId = async (req, res) => {
  try {
    const { mechanicId } = req.query;

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: "Mechanic ID is required",
      });
    }

    if (!mongoose.isValidObjectId(mechanicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mechanic ID format",
      });
    }

    const result = await widgetService.getWidgetByMechanicId(mechanicId);

    if (result === null) {
      return res.status(200).json({
        success: false,
        message: "Widget not found for the specified mechanic",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving widget by mechanic:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve widget",
    });
  }
};

const getWidgetByMechanicIdWithoutPerms = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    console.log(req.headers.origin);
    if (!mongoose.isValidObjectId(mechanicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mechanic ID format",
      });
    }

    const result = await widgetService.getWidgetByMechanicIdWithoutPerms(
      mechanicId
    );

    if (result === null) {
      return res.status(200).json({
        success: false,
        message: "Widget not found for the specified mechanic",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving widget by mechanic:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve widget",
    });
  }
};

module.exports = {
  createWidget,
  updateWidget,
  deleteWidget,
  getWidgetById,
  getWidgetByMechanicId,
  getWidgetByMechanicIdWithoutPerms,
};
