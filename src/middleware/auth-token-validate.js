const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET; 
module.exports.verifyToken = async (token) => {
  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error("Unauthorised"));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return reject(new Error("Invalid token")); 
      }
      resolve(decoded);
    });
  });
};
