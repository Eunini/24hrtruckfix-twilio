const jwt = require("jsonwebtoken");
const { HTTP_STATUS_CODES } = require("../helper");
const User = require("../models/user.model");
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

// Get user's organization (either as owner or member)
const getUserOrganization = async ({ userId, organizationId }) => {
  try {
    // If organizationId is provided (for admin users), use it directly
    if (organizationId) {
      const organization = await Organization.findById(organizationId);
      if (organization) {
        return {
          organizationId: organization._id,
          organizationRole: "admin_access",
          organization: organization,
        };
      }
      return null;
    }

    // First check if user is an owner of any organization
    let organization = await Organization.findOne({ owner: userId });

    if (organization) {
      return {
        organizationId: organization._id,
        organizationRole: "owner",
        organization: organization,
      };
    }

    // If not owner, check if user is a member of any organization
    organization = await Organization.findOne({
      "members.user": userId,
      "members.status": "approved", // Only approved members
    });

    if (organization) {
      // Find the specific member entry to get additional details
      const memberInfo = organization.members.find(
        (member) => member.user.toString() === userId.toString()
      );

      return {
        organizationId: organization._id,
        organizationRole: "member",
        organization: organization,
        memberInfo: memberInfo,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching user organization:", error);
    return null;
  }
};

// Authenticate middleware
exports.authenticate = async (req, res, next) => {
  try {
    // Check for token in headers
    const token =
      req.headers.authorization?.split(" ")[1] || req.headers["x-access-token"];
      
      // Check for API key
      const apiKey = req.query["apiKey"] || req.headers["x-api-key"];
      const sysApiKey = process.env.SETUP_VAPI_API_KEY;
      

      if ((apiKey || token) === sysApiKey) {
        console.log('Using third party, skipping auth (sys key valid)', !!sysApiKey);
        return next();
      }
   

    if (!token && !apiKey) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        message: "No authentication credentials provided",
      });
    }

    let user;

    // If API key is provided, verify it
    if (apiKey) {
      user = await User.findOne({ apiKey });
      if (!user) {
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
          message: "Invalid API key",
        });
      }
    } else {

      // If token is provided, verify it
      const decoded = await verifyToken(token);
      user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
          message: "User not found",
        });
      }
    }

    // Get user's organization information
    let organizationInfo = null;

    const role = await Role.findOne({ _id: user.role_id });

    user.role = role.name;
    // Check if user is admin/super_admin and has orgId in query
    if (["admin", "super_admin"].includes(user.role) && req.query.orgId) {
      organizationInfo = await getUserOrganization({
        organizationId: req.query.orgId,
      });
    } else {
      organizationInfo = await getUserOrganization({ userId: user._id });
    }

    // Attach user and organization info to request
    req.user = {
      userId: user._id,
      email: user.email,
      adminRole: user.adminRole || user.role, // Handle different role field names
      ...user.toObject(), // Include all user fields
      // Organization information
      organizationId: organizationInfo?.organizationId || null,
      organizationRole: organizationInfo?.organizationRole || null,
      organization: organizationInfo?.organization || null,
      memberInfo: organizationInfo?.memberInfo || null,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      message: error.message || "Authentication failed",
    });
  }
};

// Middleware to ensure user belongs to an organization
exports.requireOrganization = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      message: "Authentication required",
    });
  }

  if (
    !req.user.organizationId &&
    !["admin", "super_admin"].includes(req.user.adminRole)
  ) {
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
      message: "User must belong to an organization to access this resource",
    });
  }

  next();
};

// Middleware to ensure user is an organization owner
exports.requireOrganizationOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      message: "Authentication required",
    });
  }

  if (!req.user.organizationId) {
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
      message: "User must belong to an organization",
    });
  }

  if (req.user.organizationRole !== "owner") {
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
      message: "Organization owner access required",
    });
  }

  next();
};
