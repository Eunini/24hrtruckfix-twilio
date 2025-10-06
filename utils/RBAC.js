// middleware/roleAuth.js
const jwt = require("jsonwebtoken");
const { validateToken } = require("./authMiddleware");
const { extractUserFromEvent } = require("../middleware/extract-user");

/**
 * Enhanced RBAC middleware with action restrictions and hierarchical permissions
 * @param {Object} options - Configuration options
 * @param {mongoose.Model} options.model - Mongoose model to check against
 * @param {string} options.roleField - Field name where role is stored (default: 'role')
 * @param {string[]} options.requiredRoles - Minimum required roles (default: ['superadmin'])
 * @param {string[]} [options.disallowedActions] - HTTP methods to block (except for superadmin)
 * @param {string} options.idParam - Route param name for resource ID (default: 'id')
 * @param {boolean} options.allowSelf - Whether to allow access to own resource (default: false)
 */
const roleAuth = ({
  model,
  roleField = "role",
  requiredRoles = ["superadmin"],
  disallowedActions = [],
  idParam = "id",
  allowSelf = false,
} = {}) => {
  if (!model) throw new Error("Model must be provided");

  return async (req, res, next) => {
    try {
      // 1. Validate JWT token
      const tokenError = await validateToken(req);
      if (tokenError) return res.status(401).json(tokenError);

      const currentUser = await extractUserFromEvent(req);

      if (!currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      req.user = currentUser.userId; // Attach user to request object

      console.log({ req });

      // 2. Check for disallowed actions (unless superadmin)
      if (disallowedActions.includes(req.method.toLowerCase())) {
        if (req.user.role !== "superadmin") {
          return res.status(403).json({
            error: `Action ${req.method} is not allowed for your role`,
          });
        }
      }

      // 3. Check if user has required role
      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Access denied. Required roles: ${requiredRoles.join(", ")}`,
        });
      }

      // 4. Resource access control
      const resourceId = req.params[idParam];
      if (resourceId) {
        // For operations on specific resources
        const resource = await model.findById(resourceId);
        if (!resource) {
          return res.status(404).json({ error: "Resource not found" });
        }

        // Superadmin bypasses all checks
        if (req.user.role === "superadmin") {
          req.resource = resource;
          return next();
        }

        // Admin can access all client records
        if (req.user.role === "admin") {
          req.resource = resource;
          return next();
        }

        // Client can only access their own data
        if (req.user.role === "client") {
          if (resource._id.toString() !== req.user._id.toString()) {
            return res
              .status(403)
              .json({ error: "Access to other client data denied" });
          }
          req.resource = resource;
          return next();
        }

        // Sub-admin/agent/sub-agent access control
        if (["subadmin", "agent", "subagent"].includes(req.user.role)) {
          // Implement your specific logic for these roles
          // Example: Check if resource belongs to user's client/team
          if (
            resource.clientId &&
            resource.clientId.toString() !== req.user.clientId.toString()
          ) {
            return res
              .status(403)
              .json({ error: "Access to this client data denied" });
          }
          req.resource = resource;
          return next();
        }
      }

      // 5. For collection-level operations (like GET /resources)
      if (req.user.role === "superadmin" || req.user.role === "admin") {
        return next();
      }

      // Restrict collection-level access for other roles
      if (!resourceId && !["superadmin", "admin"].includes(req.user.role)) {
        return res.status(403).json({
          error: "You only have access to specific resources",
        });
      }

      next();
    } catch (error) {
      console.error("RBAC Error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
};

module.exports = roleAuth;

//Example usage (note this will be in the handler level)

// A - super admin only resource
// const { roleAuth } = require('../middleware/roleAuth');
// const User = require('../models/User');
//
// const inboundCallController = async (event, context) => {
//     // Your existing call logic
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ message: 'Call initiated' })
//     };
// };
//
// module.exports.inboundCallController = awsExport(
//     inboundCallController,
//     [
//         roleAuth({
//             model: User,
//             requiredRoles: ['superadmin'] // Only superadmin can initiate calls
//         })
//     ]
// );

// B - Agent Admin level
// // functions/SMS.js
// const { roleAuth } = require('../middleware/roleAuth');
// const User = require('../models/User');
//
// const sendLocationSms = async (event, context) => {
//     // Your existing SMS logic
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ message: 'SMS sent' })
//     };
// };
//
// module.exports.sendLocationSms = awsExport(
//     sendLocationSms,
//     [
//         roleAuth({
//             model: User,
//             requiredRoles: ['agent', 'subagent', 'admin', 'superadmin'],
//             disallowedActions: ['delete'] // Prevent SMS deletion
//         })
//     ]
// );

// C - Client resource
// // functions/ActivateUser.js
// const { roleAuth } = require('../middleware/roleAuth');
// const User = require('../models/User');
//
// const activateUser = async (event, context) => {
//     // Your existing activation logic
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ message: 'User activated' })
//     };
// };
//
// module.exports.activateUser = awsExport(
//     activateUser,
//     [
//         roleAuth({
//             model: User,
//             requiredRoles: ['client'],
//             idParam: 'userId', // matches your route parameter
//             allowSelf: true // allows clients to activate themselves
//         })
//     ]
// );

// D -  Admin only resource
// // functions/GetAllActivityLoggings.js
// const { roleAuth } = require('../middleware/roleAuth');
// const User = require('../models/User');
//
// const getAllActivityLogging = async (event, context) => {
//     // Your existing logic
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ data: yourActivityData })
//     };
// };
//
// module.exports.getAllActivityLogging = awsExport(
//     getAllActivityLogging,
//     [
//         roleAuth({
//             model: User,
//             requiredRoles: ['admin', 'superadmin'],
//             disallowedActions: ['post', 'put', 'delete'] // Only allow GET
//         })
//     ]
// );
