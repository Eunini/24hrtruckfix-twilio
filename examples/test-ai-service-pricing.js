/**
 * Example: AI-Powered Service Pricing Calculator
 *
 * This example demonstrates how to use the AI service pricing calculator
 * which takes a user prompt and ticket ID to generate intelligent pricing
 * recommendations using OpenAI.
 */

const axios = require("axios");

// Configuration
const BASE_URL = process.env.SERVER_URL || "http://localhost:3000";
const API_ENDPOINT = `${BASE_URL}/api/v1/services/ai-calculate-pricing`;

// Example usage function
async function testAIServicePricing() {
  try {
    console.log("🤖 Testing AI-Powered Service Pricing Calculator...\n");

    // Example 1: Basic tire issue with user prompt
    const example1 = {
      ticketId: "64a7b8c9d123456789abcdef", // Replace with actual ticket ID
      userPrompt:
        "Customer has a flat tire on highway 101, needs roadside assistance immediately. Weather is rainy and it's getting dark.",
    };

    console.log("📋 Example 1: Emergency Flat Tire");
    console.log("User Prompt:", example1.userPrompt);
    console.log("Ticket ID:", example1.ticketId);

    const response1 = await makeAIRequest(example1);
    console.log("🎯 AI Response:");
    console.log(response1.aiResponse);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 2: Battery issue with specific requirements
    const example2 = {
      ticketId: "64a7b8c9d123456789abcdef", // Replace with actual ticket ID
      userPrompt:
        "Customer's car won't start, battery seems dead. They're in a parking lot at a shopping mall. Need to know if they need towing or if a jump start would work.",
    };

    console.log("📋 Example 2: Battery Issue");
    console.log("User Prompt:", example2.userPrompt);
    console.log("Ticket ID:", example2.ticketId);

    const response2 = await makeAIRequest(example2);
    console.log("🎯 AI Response:");
    console.log(response2.aiResponse);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 3: Complex situation requiring multiple services
    const example3 = {
      ticketId: "64a7b8c9d123456789abcdef", // Replace with actual ticket ID
      userPrompt:
        "Customer's vehicle broke down 20 miles from the city. The engine overheated and they need towing to the nearest repair shop. The vehicle is a heavy-duty truck.",
    };

    console.log("📋 Example 3: Complex Breakdown with Towing");
    console.log("User Prompt:", example3.userPrompt);
    console.log("Ticket ID:", example3.ticketId);

    const response3 = await makeAIRequest(example3);
    console.log("🎯 AI Response:");
    console.log(response3.aiResponse);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 4: Quick estimate request
    const example4 = {
      ticketId: "64a7b8c9d123456789abcdef", // Replace with actual ticket ID
      userPrompt:
        "Customer wants a quick estimate for lockout service and potential tire replacement. They're at their office parking garage.",
    };

    console.log("📋 Example 4: Estimate Request");
    console.log("User Prompt:", example4.userPrompt);
    console.log("Ticket ID:", example4.ticketId);

    const response4 = await makeAIRequest(example4);
    console.log("🎯 AI Response:");
    console.log(response4.aiResponse);
  } catch (error) {
    console.error("❌ Error testing AI service pricing:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Status code:", error.response.status);
    }
  }
}

// Helper function to make API request
async function makeAIRequest(data) {
  const config = {
    method: "POST",
    url: API_ENDPOINT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.JWT_TOKEN}`, // Replace with actual JWT token
    },
    data: data,
  };

  const response = await axios(config);
  return response.data;
}

// Run the examples
if (require.main === module) {
  // Set up environment variables before running
  if (!process.env.JWT_TOKEN) {
    console.log("⚠️  Please set JWT_TOKEN environment variable");
    console.log(
      "   Example: JWT_TOKEN=your_jwt_token node examples/test-ai-service-pricing.js"
    );
    process.exit(1);
  }

  testAIServicePricing()
    .then(() => {
      console.log("\n✅ AI Service Pricing testing completed!");
    })
    .catch((error) => {
      console.error("❌ Test failed:", error.message);
      process.exit(1);
    });
}

// Export for use in other files
module.exports = { testAIServicePricing, makeAIRequest };

/* 
EXAMPLE OUTPUT:

🤖 Testing AI-Powered Service Pricing Calculator...

📋 Example 1: Emergency Flat Tire
User Prompt: Customer has a flat tire on highway 101, needs roadside assistance immediately. Weather is rainy and it's getting dark.
Ticket ID: 64a7b8c9d123456789abcdef
🎯 AI Response:
**SERVICE PRICING ANALYSIS**

**Recommended Services:**
1. Flat Tire Service - $75.00
   - Emergency roadside tire change
   - Includes safety equipment for highway service

**Weather & Safety Considerations:**
- Rainy conditions require additional safety precautions
- Highway location increases risk factor
- Emergency response recommended due to visibility concerns

**Total Cost Breakdown:**
- Service Total: $75.00
- Towing Cost: $0.00 (on-site service)
- **Grand Total: $75.00**

**Notes:**
- Mechanic should bring extra lighting equipment
- High-visibility safety gear required
- Estimated service time: 30-45 minutes due to weather conditions

================================================================================

📋 Example 2: Battery Issue
[Additional examples would follow...]

*/
