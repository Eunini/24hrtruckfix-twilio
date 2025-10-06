/**
 * Service Pricing Calculator with Towing Test Example
 *
 * This file demonstrates how to use the updated service pricing calculator
 * that includes towing cost calculations based on vehicle classification.
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
  // 1. Calculate service pricing without towing
  async calculateBasicServicePricing() {
    console.log("\n--- Basic Service Pricing (No Towing) ---");

    const pricingData = {
      services: ["service-id-1", "service-id-2"], // Replace with actual service IDs
      amount: 200.0,
      state: "CA",
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Basic pricing result:", result);
      return result;
    } catch (error) {
      console.error("Failed to calculate basic pricing:", error.message);
    }
  },

  // 2. Calculate service pricing with towing (under 5 miles - free)
  async calculateServicePricingWithFreeTowing() {
    console.log("\n--- Service Pricing with Free Towing (Under 5 Miles) ---");

    const pricingData = {
      services: ["service-id-1", "service-id-2"], // Replace with actual service IDs
      amount: 200.0,
      state: "CA",
      isTowing: true,
      vehicleType: "light_duty",
      milesToCover: 3, // Under 5 miles, so towing should be free
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Free towing result:", result);
      return result;
    } catch (error) {
      console.error("Failed to calculate free towing pricing:", error.message);
    }
  },

  // 3. Calculate service pricing with paid towing (over 5 miles)
  async calculateServicePricingWithPaidTowing() {
    console.log("\n--- Service Pricing with Paid Towing (Over 5 Miles) ---");

    const pricingData = {
      services: ["service-id-1", "service-id-2"], // Replace with actual service IDs
      amount: 300.0,
      state: "CA",
      isTowing: true,
      vehicleType: "heavy_duty",
      milesToCover: 15, // 10 billable miles (15 - 5 free miles)
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Paid towing result:", result);
      console.log("Towing breakdown:", result.towingDetails);
      return result;
    } catch (error) {
      console.error("Failed to calculate paid towing pricing:", error.message);
    }
  },

  // 4. Test different vehicle types
  async testDifferentVehicleTypes() {
    console.log("\n--- Testing Different Vehicle Types ---");

    const vehicleTypes = ["light_duty", "medium_duty", "heavy_duty"];
    const milesToCover = 10; // 5 billable miles

    for (const vehicleType of vehicleTypes) {
      try {
        const pricingData = {
          services: ["service-id-1"], // Replace with actual service ID
          amount: 250.0,
          state: "CA",
          isTowing: true,
          vehicleType: vehicleType,
          milesToCover: milesToCover,
        };

        const result = await apiCall(
          "POST",
          "/services/calculate-pricing",
          pricingData
        );
        console.log(`${vehicleType.toUpperCase()} towing:`, {
          towingCost: result.towingCost,
          ratePerMile: result.towingDetails?.ratePerMile,
          billableMiles: result.towingDetails?.billableMiles,
        });
      } catch (error) {
        console.error(
          `Failed to calculate ${vehicleType} pricing:`,
          error.message
        );
      }
    }
  },

  // 5. Error case - towing without vehicle type
  async testTowingWithoutVehicleType() {
    console.log("\n--- Error Test: Towing Without Vehicle Type ---");

    const pricingData = {
      services: ["service-id-1"],
      amount: 200.0,
      state: "CA",
      isTowing: true,
      milesToCover: 10,
      // Missing vehicleType - should fail
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Unexpected success:", result);
    } catch (error) {
      console.log("Expected error for missing vehicle type:", error.message);
    }
  },

  // 6. Error case - invalid vehicle type
  async testInvalidVehicleType() {
    console.log("\n--- Error Test: Invalid Vehicle Type ---");

    const pricingData = {
      services: ["service-id-1"],
      amount: 200.0,
      state: "CA",
      isTowing: true,
      vehicleType: "invalid_type", // Invalid vehicle type
      milesToCover: 10,
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Unexpected success:", result);
    } catch (error) {
      console.log("Expected error for invalid vehicle type:", error.message);
    }
  },

  // 7. Complex scenario with multiple services and towing
  async calculateComplexScenario() {
    console.log("\n--- Complex Scenario: Multiple Services + Towing ---");

    const pricingData = {
      services: ["service-id-1", "service-id-2", "service-id-3"], // Replace with actual service IDs
      amount: 500.0,
      state: "TX",
      isTowing: true,
      vehicleType: "medium_duty",
      milesToCover: 25, // 20 billable miles
    };

    try {
      const result = await apiCall(
        "POST",
        "/services/calculate-pricing",
        pricingData
      );
      console.log("Complex scenario result:", {
        serviceTotal: result.serviceTotal,
        towingCost: result.towingCost,
        grandTotal: result.total,
        isAcceptable: result.isAcceptable,
        towingBreakdown: result.towingDetails,
      });
      return result;
    } catch (error) {
      console.error("Failed to calculate complex scenario:", error.message);
    }
  },
};

// Main execution function
async function runExamples() {
  console.log("🚛 Service Pricing Calculator with Towing Examples");
  console.log("===================================================");

  try {
    // Run examples
    await examples.calculateBasicServicePricing();
    await examples.calculateServicePricingWithFreeTowing();
    await examples.calculateServicePricingWithPaidTowing();
    await examples.testDifferentVehicleTypes();
    await examples.testTowingWithoutVehicleType();
    await examples.testInvalidVehicleType();
    await examples.calculateComplexScenario();

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
 * 2. Replace service IDs with real service IDs from your database
 * 3. Ensure vehicle classifications exist for your organization
 * 4. Run: node examples/test-service-pricing-with-towing.js
 *
 * API ENDPOINT:
 * POST /api/v1/services/calculate-pricing
 *
 * REQUEST BODY (Basic):
 * {
 *   "services": ["service-id-1", "service-id-2"],
 *   "amount": 200.00,
 *   "state": "CA"
 * }
 *
 * REQUEST BODY (With Towing):
 * {
 *   "services": ["service-id-1", "service-id-2"],
 *   "amount": 300.00,
 *   "state": "CA",
 *   "isTowing": true,
 *   "vehicleType": "heavy_duty",
 *   "milesToCover": 15
 * }
 *
 * RESPONSE (With Towing):
 * {
 *   "serviceTotal": 150.00,
 *   "towingCost": 35.00,
 *   "total": 185.00,
 *   "amount": 300.00,
 *   "state": "CA",
 *   "isAcceptable": true,
 *   "towingDetails": {
 *     "vehicleType": "heavy_duty",
 *     "milesToCover": 15,
 *     "freeMiles": 5,
 *     "billableMiles": 10,
 *     "ratePerMile": 3.5,
 *     "towingCost": 35.00
 *   }
 * }
 *
 * TOWING CALCULATION RULES:
 * - First 5 miles are free
 * - Billable miles = milesToCover - 5 (minimum 0)
 * - Towing cost = billable miles × organization's ratePerMile for vehicle type
 * - Vehicle types: light_duty, medium_duty, heavy_duty
 * - Requires organization to have vehicle classification configured
 */
