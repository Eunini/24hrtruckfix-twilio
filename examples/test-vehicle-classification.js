/**
 * Vehicle Classification API Test Example
 *
 * This file demonstrates how to use the vehicle classification endpoints
 * to create, update, and retrieve vehicle classifications for organizations.
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-jwt-token-here"; // Replace with actual token

// Helper function to make authenticated API calls
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

// Example usage functions
const examples = {
  // 1. Create or update a vehicle classification (upsert)
  async upsertVehicleClassification() {
    console.log("\n--- Upsert Vehicle Classification ---");

    const vehicleClassificationData = {
      organizationId: "507f1f77bcf86cd799439011", // Replace with actual organization ID
      vehicleType: "light_duty", // Options: light_duty, heavy_duty, medium_duty
      price: 150.0,
      ratePerReturnMile: 2.5,
      ratePerMile: 3.0,
    };

    try {
      const result = await apiCall(
        "POST",
        "/vehicle-classifications",
        vehicleClassificationData
      );
      console.log("Vehicle classification saved:", result);
      return result;
    } catch (error) {
      console.error("Failed to upsert vehicle classification:", error.message);
    }
  },

  // 2. Get all vehicle classifications for a specific organization
  async getVehicleClassificationsByOrganization(organizationId) {
    console.log("\n--- Get Vehicle Classifications by Organization ---");

    try {
      const result = await apiCall(
        "GET",
        `/vehicle-classifications/organization/${organizationId}`
      );
      console.log("Organization vehicle classifications:", result);
      return result;
    } catch (error) {
      console.error("Failed to get vehicle classifications:", error.message);
    }
  },

  // 3. Get a specific vehicle classification
  async getSpecificVehicleClassification(organizationId, vehicleType) {
    console.log("\n--- Get Specific Vehicle Classification ---");

    try {
      const result = await apiCall(
        "GET",
        `/vehicle-classifications/${organizationId}/${vehicleType}`
      );
      console.log("Specific vehicle classification:", result);
      return result;
    } catch (error) {
      console.error(
        "Failed to get specific vehicle classification:",
        error.message
      );
    }
  },

  // 4. Get all vehicle classifications (admin view)
  async getAllVehicleClassifications() {
    console.log("\n--- Get All Vehicle Classifications ---");

    try {
      const result = await apiCall("GET", "/vehicle-classifications");
      console.log("All vehicle classifications:", result);
      return result;
    } catch (error) {
      console.error(
        "Failed to get all vehicle classifications:",
        error.message
      );
    }
  },

  // 5. Delete a vehicle classification
  async deleteVehicleClassification(organizationId, vehicleType) {
    console.log("\n--- Delete Vehicle Classification ---");

    try {
      const result = await apiCall(
        "DELETE",
        `/vehicle-classifications/${organizationId}/${vehicleType}`
      );
      console.log("Vehicle classification deleted:", result);
      return result;
    } catch (error) {
      console.error("Failed to delete vehicle classification:", error.message);
    }
  },

  // 6. Comprehensive example - Set up all vehicle types for an organization
  async setupAllVehicleTypes(organizationId) {
    console.log("\n--- Setup All Vehicle Types for Organization ---");

    const vehicleTypes = [
      {
        vehicleType: "light_duty",
        price: 125.0,
        ratePerReturnMile: 2.0,
        ratePerMile: 2.5,
      },
      {
        vehicleType: "medium_duty",
        price: 175.0,
        ratePerReturnMile: 2.5,
        ratePerMile: 3.0,
      },
      {
        vehicleType: "heavy_duty",
        price: 225.0,
        ratePerReturnMile: 3.0,
        ratePerMile: 3.5,
      },
    ];

    for (const vehicleTypeData of vehicleTypes) {
      try {
        const result = await apiCall("POST", "/vehicle-classifications", {
          organizationId,
          ...vehicleTypeData,
        });
        console.log(
          `✓ ${vehicleTypeData.vehicleType}: $${vehicleTypeData.price}`,
          result
        );
      } catch (error) {
        console.error(
          `✗ Failed to set ${vehicleTypeData.vehicleType}:`,
          error.message
        );
      }
    }
  },
};

// Main execution function
async function runExamples() {
  console.log("🚛 Vehicle Classification API Examples");
  console.log("=====================================");

  const organizationId = "507f1f77bcf86cd799439011"; // Replace with actual organization ID

  try {
    // Run examples
    await examples.upsertVehicleClassification();
    await examples.getVehicleClassificationsByOrganization(organizationId);
    await examples.getSpecificVehicleClassification(
      organizationId,
      "light_duty"
    );
    await examples.getAllVehicleClassifications();
    await examples.setupAllVehicleTypes(organizationId);

    console.log("\n✅ All examples completed!");
  } catch (error) {
    console.error("\n❌ Example execution failed:", error.message);
  }
}

// Export for use in other files
module.exports = {
  examples,
  runExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

/**
 * USAGE INSTRUCTIONS:
 *
 * 1. Update the AUTH_TOKEN with a valid JWT token
 * 2. Update the organizationId with a real organization ID from your database
 * 3. Run: node examples/test-vehicle-classification.js
 *
 * API ENDPOINTS SUMMARY:
 *
 * POST   /api/v1/vehicle-classifications                              - Create/Update vehicle classification
 * GET    /api/v1/vehicle-classifications                              - Get all vehicle classifications
 * GET    /api/v1/vehicle-classifications/organization/:organizationId - Get by organization
 * GET    /api/v1/vehicle-classifications/:organizationId/:vehicleType - Get specific classification
 * DELETE /api/v1/vehicle-classifications/:organizationId/:vehicleType - Delete classification
 *
 * VEHICLE TYPES:
 * - light_duty
 * - medium_duty
 * - heavy_duty
 *
 * CONSTRAINT:
 * Each organization can only have ONE classification per vehicle type.
 * The upsert endpoint will update existing records or create new ones.
 */
