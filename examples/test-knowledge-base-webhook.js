/**
 * Knowledge Base Webhook Test Example
 *
 * This file demonstrates how to use the new knowledge base chat webhook endpoint
 * that handles both VAPI function calls and direct API calls.
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-jwt-token-here"; // Replace with actual token if needed

// Helper function to make API calls
const apiCall = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Add auth token if provided
    if (AUTH_TOKEN && AUTH_TOKEN !== "your-jwt-token-here") {
      config.headers.Authorization = `Bearer ${AUTH_TOKEN}`;
    }

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
  // 1. Test direct API call (non-VAPI)
  async testDirectAPICall() {
    console.log("\n--- Testing Direct API Call ---");

    try {
      const response = await apiCall(
        "POST",
        "/webhook/knowledge-base/test-org-123/chat",
        {
          message: "how many chapters are in the book",
        }
      );

      console.log("✅ Direct API Response:", response);
      return response;
    } catch (error) {
      console.error("❌ Direct API Call Failed:", error.message);
    }
  },

  // 2. Test VAPI function call format
  async testVAPIFunctionCall() {
    console.log("\n--- Testing VAPI Function Call ---");

    try {
      const response = await apiCall(
        "POST",
        "/webhook/knowledge-base/test-org-123/chat",
        {
          message: {
            toolCalls: [
              {
                id: "call_123",
                function: {
                  name: "knowledge_base_chat",
                  arguments: {
                    message: "what is the main theme of the book",
                  },
                },
              },
            ],
          },
        }
      );

      console.log("✅ VAPI Function Call Response:", response);
      return response;
    } catch (error) {
      console.error("❌ VAPI Function Call Failed:", error.message);
    }
  },

  // 3. Test with different questions
  async testVariousQuestions() {
    console.log("\n--- Testing Various Questions ---");

    const questions = [
      "What is the summary of chapter 1?",
      "Who are the main characters?",
      "What is the setting of the story?",
      "What are the key themes?",
    ];

    for (const question of questions) {
      try {
        console.log(`\n🔍 Question: ${question}`);
        const response = await apiCall(
          "POST",
          "/webhook/knowledge-base/test-org-123/chat",
          {
            message: question,
          }
        );

        console.log("✅ Response:", response);
      } catch (error) {
        console.error(`❌ Failed for question "${question}":`, error.message);
      }
    }
  },

  // 4. Test error handling
  async testErrorHandling() {
    console.log("\n--- Testing Error Handling ---");

    try {
      // Test with missing message
      const response = await apiCall(
        "POST",
        "/webhook/knowledge-base/test-org-123/chat",
        {}
      );
      console.log("✅ Empty Request Response:", response);
    } catch (error) {
      console.log(
        "✅ Expected Error for Empty Request:",
        error.response?.status,
        error.response?.data
      );
    }

    try {
      // Test with invalid message format
      const response = await apiCall(
        "POST",
        "/webhook/knowledge-base/test-org-123/chat",
        {
          message: null,
        }
      );
      console.log("✅ Null Message Response:", response);
    } catch (error) {
      console.log(
        "✅ Expected Error for Null Message:",
        error.response?.status,
        error.response?.data
      );
    }
  },
};

// Main test function
async function runTests() {
  console.log("🧪 Testing Knowledge Base Webhook Endpoint...\n");

  try {
    // Run all tests
    await examples.testDirectAPICall();
    await examples.testVAPIFunctionCall();
    await examples.testVariousQuestions();
    await examples.testErrorHandling();

    console.log("\n🎉 All tests completed!");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
  }
}

// Export for use in other files
module.exports = {
  examples,
  runTests,
  apiCall,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}
