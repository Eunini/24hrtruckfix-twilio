const jwt = require("jsonwebtoken");
const config = require("../config");

// exports.authorize = async (req, res, next) => {
//   try {
//     console.log("authorize middleware");
//     console.log(req.path);
//     // Get token from header
//     const token = req.header("Authorization")?.replace("Bearer ", "");

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         error: "No token provided, authorization denied",
//       });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, config.jwt.secret);

//     // Add user from payload
//     req.user = decoded;
//     next();
//   } catch (error) {
//     console.error("Auth middleware error:", error);
//     res.status(401).json({
//       success: false,
//       error: "Token is not valid",
//     });
//   }
// };

// Optional: Role-based authorization middleware
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      });
    }
    next();
  };
};
