/**
 * Mechanic Details API Test Example
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-jwt-token-here";

// Helper function to make API calls
const apiCall = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    throw error;
  }
};

// Example functions
const examples = {
  // 1. Create mechanic details
  async createMechanicDetails() {
    console.log("\n--- Create Mechanic Details ---");

    const detailsData = {
      mechanicId: "507f1f77bcf86cd799439011", // Replace with actual mechanic ID
      details:
        "Mechanic has 10+ years experience with diesel engines. Specializes in brake repair and electrical systems.",
    };

    try {
      const result = await apiCall("POST", "/mechanic-details", detailsData);
      console.log("Created:", result);
      return result;
    } catch (error) {
      console.error("Failed to create:", error.message);
    }
  },

  // 2. Get all details for a mechanic
  async getMechanicDetails(mechanicId) {
    console.log("\n--- Get Mechanic Details ---");

    try {
      const result = await apiCall(
        "GET",
        `/mechanic-details/mechanic/${mechanicId}`
      );
      console.log("Details:", result);
      return result;
    } catch (error) {
      console.error("Failed to get details:", error.message);
    }
  },

  // 3. Get single detail
  async getSingleDetail(detailId) {
    console.log("\n--- Get Single Detail ---");

    try {
      const result = await apiCall("GET", `/mechanic-details/${detailId}`);
      console.log("Single detail:", result);
      return result;
    } catch (error) {
      console.error("Failed to get single detail:", error.message);
    }
  },
};

// Main function
async function runExamples() {
  console.log("🔧 Mechanic Details API Examples");
  console.log("=================================");

  try {
    await examples.createMechanicDetails();
    await examples.getMechanicDetails("507f1f77bcf86cd799439011");

    console.log("\n✅ Examples completed!");
  } catch (error) {
    console.error("\n❌ Examples failed:", error.message);
  }
}

module.exports = { examples, runExamples };

if (require.main === module) {
  runExamples();
}
