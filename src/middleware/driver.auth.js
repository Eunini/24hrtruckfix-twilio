const jwt = require("jsonwebtoken");
const { HTTP_STATUS_CODES } = require("../helper");
const Driver = require("../models/driver.model");
const Organization = require("../models/organization.model");
const Role = require("../models/role.model");

// Verify JWT token
const verifyToken = async (token) => {
  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error("Unauthorized"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return reject(new Error("Invalid token"));
      }
      resolve(decoded);
    });
  });
};

// Driver authentication middleware
exports.authenticateDriver = async (req, res, next) => {
  try {
    // Check for token in headers
    const token =
      req.headers.authorization?.split(" ")[1] || req.headers["x-access-token"];

    if (!token) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    const decoded = await verifyToken(token);
    const driver = await Driver.findById(decoded.driverId)
      .populate("role_id")
      .populate("organization");

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check if token type is allowed for this route
    if (decoded.tokenType === "registration") {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Registration token cannot be used for this endpoint",
      });
    }

    // Check if driver is active
    // if (driver.status !== "active") {
    //   return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
    //     success: false,
    //     message: "Driver account is not active",
    //   });
    // }

    // Attach driver info to request
    req.driver = {
      driverId: driver._id,
      email: driver.email,
      firstName: driver.firstName,
      lastName: driver.lastName,
      organizationId: driver.organization._id,
      organization: driver.organization,
      role: driver.role_id,
      plan: driver.plan,
      status: driver.status,
      tokenType: decoded.tokenType,
      ...driver.toObject(),
    };

    next();
  } catch (error) {
    console.error("Driver authentication error:", error);
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }
};

// Registration token middleware - allows only registration tokens
exports.authenticateRegistrationToken = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.headers["x-access-token"];

    if (!token) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "No registration token provided",
      });
    }

    const decoded = await verifyToken(token);

    // Check if this is a registration token
    if (decoded.tokenType !== "registration") {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "This endpoint requires a registration token",
      });
    }

    const driver = await Driver.findById(decoded.driverId)
      .populate("role_id")
      .populate("organization");

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Attach driver info to request
    req.driver = {
      driverId: driver._id,
      email: driver.email,
      firstName: driver.firstName,
      lastName: driver.lastName,
      organizationId: driver.organization._id,
      organization: driver.organization,
      role: driver.role_id,
      plan: driver.plan,
      status: driver.status,
      tokenType: decoded.tokenType,
      ...driver.toObject(),
    };

    next();
  } catch (error) {
    console.error("Registration token authentication error:", error);
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: error.message || "Registration token authentication failed",
    });
  }
};

// Middleware that allows both registration and regular tokens
exports.allowBothTokens = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.headers["x-access-token"];

    if (!token) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    const decoded = await verifyToken(token);
    const driver = await Driver.findById(decoded.driverId)
      .populate("role_id")
      .populate("organization");

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Driver not found",
      });
    }

    // For regular tokens, check if driver is active
    // if (decoded.tokenType === "regular" && driver.status !== "active") {
    //   return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
    //     success: false,
    //     message: "Driver account is not active",
    //   });
    // }

    // Attach driver info to request
    req.driver = {
      driverId: driver._id,
      email: driver.email,
      firstName: driver.firstName,
      lastName: driver.lastName,
      organizationId: driver.organization._id,
      organization: driver.organization,
      role: driver.role_id,
      plan: driver.plan,
      status: driver.status,
      tokenType: decoded.tokenType,
      ...driver.toObject(),
    };

    next();
  } catch (error) {
    console.error("Token authentication error:", error);
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }
};

// Middleware to block registration tokens from regular endpoints
exports.blockRegistrationToken = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.headers["x-access-token"];

    if (token) {
      const decoded = await verifyToken(token);

      if (decoded.tokenType === "registration") {
        return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
          success: false,
          message:
            "Registration tokens are not allowed for this endpoint. Please complete registration first.",
        });
      }
    }

    next();
  } catch (error) {
    // If token verification fails, let it pass to the main auth middleware
    next();
  }
};
