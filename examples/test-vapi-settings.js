/**
 * Test VAPI Assistant Call Settings API
 *
 * This file demonstrates how to use the new VAPI settings endpoints:
 * 1. Update all call settings at once
 * 2. Get current call settings
 * 3. Update specific setting categories
 */

const axios = require("axios");

// Configuration
const BASE_URL = process.env.SERVER_URL || "http://localhost:3000";
const API_TOKEN =
  process.env.API_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODJkYmNmNTdiYTVmNWU4YTM0ODJiYzciLCJ1c2VybmFtZSI6ImltZW1hcmlvNzdAZ21haWwuY29tMjU1OSIsImlhdCI6MTc1NTgwMzY5MSwiZXhwIjoxNzg3MzM5NjkxfQ.ey2GA3bytlb1BYkeQ00d9c5zDxAV_9DVaniWevpn3nA";
const ASSISTANT_ID =
  process.env.VAPI_ASSISTANT_ID || "2af22cd0-ac34-4079-9369-003230799fdc";

// Headers for authenticated requests
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

/**
 * Test 1: Update all VAPI assistant call settings at once
 */
async function testUpdateAllSettings() {
  console.log("\n🔄 Testing: Update All Call Settings");
  console.log("=====================================");

  try {
    const updateData = {
      // Frontend CallSettings interface format
      voicemailDetection: {
        enabled: true,
        action: "hang-up",
      },
      userKeypadInput: {
        enabled: true,
        timeout: 2.5,
        terminationKey: "#",
        digitLimit: 1,
      },
      endCallOnSilence: {
        enabled: true,
        duration: 5,
      },
      maxCallDuration: 1, // 1 hour
      pauseBeforeSpeaking: 0.5,
      ringDuration: 30,
      firstMessage:
        "Hello! Thank you for calling our 24-hour rescue service. How can I help you today?",
      firstMessageMode: "assistant-speaks-first",
      backgroundSound: "office",
    };

    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings`,
      updateData,
      { headers }
    );

    console.log("✅ Successfully updated all settings");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error updating all settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 2: Get current VAPI assistant call settings
 */
async function testGetCurrentSettings() {
  console.log("\n📋 Testing: Get Current Call Settings");
  console.log("=====================================");

  try {
    const response = await axios.get(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings`,
      { headers }
    );

    console.log("✅ Successfully retrieved current settings");
    console.log(
      "Current Settings:",
      JSON.stringify(response.data.data, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ Error getting current settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 3: Update specific setting categories
 */
async function testUpdateSpecificCategories() {
  console.log("\n🎯 Testing: Update Specific Setting Categories");
  console.log("=============================================");

  const categories = [
    {
      name: "voicemail",
      data: {
        enabled: true,
        action: "hang-up",
      },
    },
    {
      name: "keypad",
      data: {
        enabled: true,
        timeout: 3.0,
        terminationKey: "*",
        digitLimit: 2,
      },
    },
    {
      name: "silence",
      data: {
        enabled: true,
        duration: 7,
      },
    },
    {
      name: "timing",
      data: {
        maxCallDuration: 2, // 2 hours
        pauseBeforeSpeaking: 1.0,
        ringDuration: 45,
      },
    },
  ];

  for (const category of categories) {
    try {
      console.log(`\n🔄 Updating ${category.name} settings...`);

      const response = await axios.patch(
        `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings/${category.name}`,
        category.data,
        { headers }
      );

      console.log(`✅ Successfully updated ${category.name} settings`);
      console.log("Response:", JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error(
        `❌ Error updating ${category.name} settings:`,
        error.response?.data || error.message
      );
    }
  }
}

/**
 * Test 4: Test error handling with invalid assistant ID
 */
async function testErrorHandling() {
  console.log("\n🚨 Testing: Error Handling");
  console.log("===========================");

  try {
    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/invalid-id/settings`,
      {
        voicemailDetection: {
          enabled: true,
          action: "hang-up",
        },
      },
      { headers }
    );

    console.log("Response:", response.data);
  } catch (error) {
    console.log("✅ Expected error caught for invalid assistant ID");
    console.log("Error Status:", error.response?.status);
    console.log("Error Message:", error.response?.data?.message);
  }
}

/**
 * Test 5: Test invalid category
 */
async function testInvalidCategory() {
  console.log("\n🚨 Testing: Invalid Category Error");
  console.log("==================================");

  try {
    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings/invalid-category`,
      { enabled: true },
      { headers }
    );

    console.log("Response:", response.data);
  } catch (error) {
    console.log("✅ Expected error caught for invalid category");
    console.log("Error Status:", error.response?.status);
    console.log("Error Message:", error.response?.data?.message);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log("🚀 Starting VAPI Settings API Tests");
  console.log("====================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Assistant ID: ${ASSISTANT_ID}`);
  console.log(`API Token: ${API_TOKEN ? "✅ Set" : "❌ Not Set"}`);

  if (!API_TOKEN || API_TOKEN === "your_jwt_token_here") {
    console.log("\n⚠️  Please set a valid API_TOKEN environment variable");
    console.log('   export API_TOKEN="your_jwt_token_here"');
    return;
  }

  if (!ASSISTANT_ID || ASSISTANT_ID === "your_assistant_id_here") {
    console.log(
      "\n⚠️  Please set a valid VAPI_ASSISTANT_ID environment variable"
    );
    console.log('   export VAPI_ASSISTANT_ID="your_assistant_id_here"');
    return;
  }

  try {
    await testUpdateAllSettings();
    await testGetCurrentSettings();
    await testUpdateSpecificCategories();
    await testErrorHandling();
    await testInvalidCategory();

    console.log("\n🎉 All tests completed!");
  } catch (error) {
    console.error("\n💥 Test suite failed:", error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testUpdateAllSettings,
  testGetCurrentSettings,
  testUpdateSpecificCategories,
  testErrorHandling,
  testInvalidCategory,
  runAllTests,
};
