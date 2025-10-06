const mechanicDetailsService = require("../services/mechanic-details.service");
const { HTTP_STATUS_CODES } = require("../helper");

// Create new mechanic details with AI research
exports.createMechanicDetails = async (req, res) => {
  try {
    const { mechanicId } = req.body;
    const createdBy = req.user.userId;

    // Validate required fields
    if (!mechanicId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Mechanic ID is required",
      });
    }

    const result = await mechanicDetailsService.createMechanicDetails(
      mechanicId,
      createdBy
    );

    res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      message: "AI-generated mechanic research details created successfully",
      data: result,
    });
  } catch (error) {
    console.error("createMechanicDetails error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all details for a specific mechanic
exports.getMechanicDetailsByMechanicId = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await mechanicDetailsService.getMechanicDetailsByMechanicId(
      mechanicId,
      page,
      limit
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getMechanicDetailsByMechanicId error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a single mechanic detail by ID
exports.getMechanicDetailById = async (req, res) => {
  try {
    const { detailId } = req.params;

    const result = await mechanicDetailsService.getMechanicDetailById(detailId);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getMechanicDetailById error:", error);
    if (error.message === "Mechanic detail not found") {
      res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: error.message,
      });
    }
  }
};

// Get all mechanic details (admin view)
exports.getAllMechanicDetails = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const result = await mechanicDetailsService.getAllMechanicDetails(
      page,
      limit,
      search
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getAllMechanicDetails error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Update mechanic details
exports.updateMechanicDetails = async (req, res) => {
  try {
    const { detailId } = req.params;
    const { details } = req.body;
    const updatedBy = req.user.userId;

    const result = await mechanicDetailsService.updateMechanicDetails(
      detailId,
      details,
      updatedBy
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Mechanic details updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("updateMechanicDetails error:", error);
    if (error.message === "Mechanic detail not found") {
      res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: error.message,
      });
    }
  }
};

// Delete mechanic details
exports.deleteMechanicDetails = async (req, res) => {
  try {
    const { detailId } = req.params;

    const result = await mechanicDetailsService.deleteMechanicDetails(detailId);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Mechanic details deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("deleteMechanicDetails error:", error);
    if (error.message === "Mechanic detail not found") {
      res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: error.message,
      });
    }
  }
};
