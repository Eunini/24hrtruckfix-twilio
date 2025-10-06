/**
 * Simple Test for VAPI Assistant Call Settings API
 *
 * This file tests the fixed VAPI settings endpoints with the correct
 * frontend CallSettings interface format.
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
 * Test 1: Update only basic settings (correct frontend format)
 */
async function testUpdateBasicSettings() {
  console.log("\n🔄 Testing: Update Basic Settings (Correct Frontend Format)");
  console.log("=============================================================");

  try {
    const updateData = {
      // Frontend CallSettings interface format
      voicemailDetection: {
        enabled: true,
        action: "hang-up"
      },
      userKeypadInput: {
        enabled: true,
        timeout: 2.5,
        terminationKey: "#",
        digitLimit: 1
      },
      endCallOnSilence: {
        enabled: true,
        duration: 5
      },
      maxCallDuration: 1, // 1 hour
      pauseBeforeSpeaking: 0.5,
      ringDuration: 30
    };

    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings`,
      updateData,
      { headers }
    );

    console.log("✅ Successfully updated basic settings");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error updating basic settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 2: Update voicemail settings only
 */
async function testUpdateVoicemailOnly() {
  console.log("\n🔄 Testing: Update Voicemail Settings Only");
  console.log("==========================================");

  try {
    const updateData = {
      enabled: true,
      action: "hang-up"
    };

    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings/voicemail`,
      updateData,
      { headers }
    );

    console.log("✅ Successfully updated voicemail settings");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error updating voicemail settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 3: Update keypad settings only
 */
async function testUpdateKeypadOnly() {
  console.log("\n🔄 Testing: Update Keypad Settings Only");
  console.log("========================================");

  try {
    const updateData = {
      enabled: true,
      timeout: 3.0,
      terminationKey: "*",
      digitLimit: 2
    };

    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings/keypad`,
      updateData,
      { headers }
    );

    console.log("✅ Successfully updated keypad settings");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error updating keypad settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 4: Update timing settings only
 */
async function testUpdateTimingOnly() {
  console.log("\n🔄 Testing: Update Timing Settings Only");
  console.log("========================================");

  try {
    const updateData = {
      maxCallDuration: 2, // 2 hours
      pauseBeforeSpeaking: 1.0,
      ringDuration: 45
    };

    const response = await axios.patch(
      `${BASE_URL}/api/v1/vapi/assistant/${ASSISTANT_ID}/settings/timing`,
      updateData,
      { headers }
    );

    console.log("✅ Successfully updated timing settings");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      "❌ Error updating timing settings:",
      error.response?.data || error.message
    );
  }
}

/**
 * Test 5: Get current settings
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
 * Main test runner
 */
async function runSimpleTests() {
  console.log("🚀 Starting Simple VAPI Settings API Tests");
  console.log("==========================================");
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
    await testUpdateBasicSettings();
    await testUpdateVoicemailOnly();
    await testUpdateKeypadOnly();
    await testUpdateTimingOnly();
    await testGetCurrentSettings();

    console.log("\n🎉 All simple tests completed!");
  } catch (error) {
    console.error("\n💥 Test suite failed:", error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSimpleTests();
}

module.exports = {
  testUpdateBasicSettings,
  testUpdateVoicemailOnly,
  testUpdateKeypadOnly,
  testUpdateTimingOnly,
  testGetCurrentSettings,
  runSimpleTests,
};
