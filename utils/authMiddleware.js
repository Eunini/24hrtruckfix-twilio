const { verifyToken } = require("../middleware/auth-token-validate");
const UserModel = require("../db-models/mongo/models/users");
const { getMongoConnection } = require("../loaders/mongo/connect");

exports.validateToken = async (event) => {
  try {
    // console.log({ event });
    const token = event.headers.Authorization || event.headers.authorization;
    console.log("Token from header:", token);

    if (!token) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          success: false,
          message: "Unauthorized",
        },
      };
    }

    // await verifyToken(token.replace("Bearer ", "").trim());

    // add user to req.user
    event.user = await verifyToken(token.replace("Bearer ", "").trim());

    return null;
  } catch (error) {
    console.error("Token validation error:", error);
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        success: false,
        message: "Invalid or expired token",
      },
    };
  }
};

exports.validateApiKey = async (event) => {
  try {
    const apiKey = event.headers["x-api-key"];
    console.log("apiKey from header:", apiKey);

    if (!apiKey) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: { message: "Unauthorized: API key is missing" },
      };
    }

    await getMongoConnection();
    const API_KEY = await UserModel.findOne({ apiKey });

    if (!API_KEY) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: { message: "Unauthorized: Invalid API key" },
      };
    }

    console.log("API_KEY", API_KEY.apiKey);
    console.log("apiKey", apiKey);

    if (apiKey !== API_KEY.apiKey) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: { message: "Unauthorized: Invalid API key" },
      };
    }

    return null;
  } catch (error) {
    console.error("API key validation error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: { message: "Internal server error" },
    };
  }
};
