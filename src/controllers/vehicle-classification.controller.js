const vehicleClassificationService = require("../services/vehicle-classification.service");
const { HTTP_STATUS_CODES } = require("../helper");

// Upsert vehicle classification (create or update) - can be system default or organization specific
exports.upsertVehicleClassification = async (req, res) => {
  try {
    const {
      organizationId = null,
      returnMileageThreshold = 0,
      ratePerMile = 0,
      statesSpecific = [],
    } = req.body;

    const result =
      await vehicleClassificationService.upsertVehicleClassification(
        returnMileageThreshold,
        ratePerMile,
        statesSpecific,
        organizationId
      );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: organizationId
        ? "Vehicle classification saved successfully"
        : "System default vehicle classification saved successfully",
      data: result,
    });
  } catch (error) {
    console.error("upsertVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get vehicle classification by organization (falls back to system default)
exports.getVehicleClassificationByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const result =
      await vehicleClassificationService.getVehicleClassificationByOrganization(
        organizationId
      );

    if (!result) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Vehicle classification not found",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getVehicleClassificationByOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get system default vehicle classification
exports.getSystemDefaultVehicleClassification = async (req, res) => {
  try {
    const result =
      await vehicleClassificationService.getSystemDefaultVehicleClassification();

    if (!result) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "System default vehicle classification not found",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getSystemDefaultVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all vehicle classifications
exports.getAllVehicleClassifications = async (req, res) => {
  try {
    const result =
      await vehicleClassificationService.getAllVehicleClassifications();

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getAllVehicleClassifications error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete vehicle classification
exports.deleteVehicleClassification = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const result =
      await vehicleClassificationService.deleteVehicleClassification(
        organizationId || null
      );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: organizationId
        ? "Vehicle classification deleted successfully"
        : "System default vehicle classification deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("deleteVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Add state to vehicle classification
exports.addStateToVehicleClassification = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { state, returnMileageThreshold = 0, ratePerMile = 0 } = req.body;

    if (!state) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "State is required",
      });
    }

    const result =
      await vehicleClassificationService.addStateToVehicleClassification(
        state,
        returnMileageThreshold,
        ratePerMile,
        organizationId || null
      );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "State added to vehicle classification successfully",
      data: result,
    });
  } catch (error) {
    console.error("addStateToVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Update state in vehicle classification
exports.updateStateInVehicleClassification = async (req, res) => {
  try {
    const { organizationId, state } = req.params;
    const { returnMileageThreshold, ratePerMile } = req.body;

    if (returnMileageThreshold === undefined && ratePerMile === undefined) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "At least one field (returnMileageThreshold or ratePerMile) is required",
      });
    }

    const result =
      await vehicleClassificationService.updateStateInVehicleClassification(
        state,
        returnMileageThreshold,
        ratePerMile,
        organizationId || null
      );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "State updated in vehicle classification successfully",
      data: result,
    });
  } catch (error) {
    console.error("updateStateInVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete state from vehicle classification
exports.deleteStateFromVehicleClassification = async (req, res) => {
  try {
    const { organizationId, state } = req.params;

    const result =
      await vehicleClassificationService.deleteStateFromVehicleClassification(
        state,
        organizationId || null
      );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "State deleted from vehicle classification successfully",
      data: result,
    });
  } catch (error) {
    console.error("deleteStateFromVehicleClassification error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};
