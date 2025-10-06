const axios = require("axios");

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api/v1";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "your_auth_token_here";

// Helper function for API requests
const apiRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(
      `❌ API Error (${method} ${endpoint}):`,
      error.response?.data || error.message
    );
    throw error;
  }
};

// Test the new inbound AI upgrade functionality
const testInboundAIUpgrade = async () => {
  try {
    console.log("🚀 Testing Inbound AI Upgrade Functionality...\n");

    const organizationId = "YOUR_ORGANIZATION_ID_HERE"; // Replace with actual organization ID

    // Step 1: Check current organization status
    console.log("📋 Step 1: Checking current organization status...");
    try {
      const orgStatus = await apiRequest(
        "GET",
        `/organizations/${organizationId}/ai-status`
      );
      console.log(
        `   Organization: ${orgStatus.organization.companyName || "N/A"}`
      );
      console.log(`   Current Status: ${orgStatus.organization.status}`);
      console.log(`   InboundAi Setting: ${orgStatus.organization.inboundAi}`);
      console.log(`   Has AI Setup: ${orgStatus.aiSetup.hasSetup}`);

      if (orgStatus.aiSetup.hasSetup) {
        console.log(`   Phone Number: ${orgStatus.aiSetup.phoneNumber}`);
        console.log(`   AI Status: ${orgStatus.aiSetup.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking status: ${error.message}`);
    }

    // Step 2: Enable inbound AI (this should trigger phone number purchase if none exists)
    console.log("\n📋 Step 2: Enabling inbound AI...");
    const enableResult = await apiRequest(
      "PUT",
      `/organizations/${organizationId}`,
      {
        inboundAi: true,
      }
    );

    console.log(`   ✅ Organization updated successfully`);
    console.log(`   InboundAi: ${enableResult.inboundAi}`);
    console.log(`   Company Name: ${enableResult.companyName || "N/A"}`);

    // Step 3: Check AI status after enabling
    console.log("\n📋 Step 3: Checking AI status after enabling inbound AI...");
    const aiStatusAfterEnable = await apiRequest(
      "GET",
      `/organizations/${organizationId}/ai-status`
    );

    console.log("📊 AI Status After Enabling:");
    console.log(`   Has AI Setup: ${aiStatusAfterEnable.aiSetup.hasSetup}`);

    if (aiStatusAfterEnable.aiSetup.hasSetup) {
      console.log(
        `   Setup Completed: ${aiStatusAfterEnable.aiSetup.setupCompleted}`
      );
      console.log(`   AI Status: ${aiStatusAfterEnable.aiSetup.status}`);
      console.log(
        `   Phone Number: ${aiStatusAfterEnable.aiSetup.phoneNumber}`
      );
      console.log(
        `   Inbound Assistant ID: ${aiStatusAfterEnable.aiSetup.assistants.inbound}`
      );
      console.log(
        `   Outbound Assistant ID: ${aiStatusAfterEnable.aiSetup.assistants.outbound}`
      );
      console.log(
        `   Setup Date: ${new Date(
          aiStatusAfterEnable.aiSetup.setupDate
        ).toLocaleString()}`
      );
    }

    // Step 4: Disable inbound AI (this should release the phone number from VAPI)
    console.log("\n📋 Step 4: Disabling inbound AI...");
    const disableResult = await apiRequest(
      "PUT",
      `/organizations/${organizationId}`,
      {
        inboundAi: false,
      }
    );

    console.log(`   ✅ Organization updated successfully`);
    console.log(`   InboundAi: ${disableResult.inboundAi}`);

    // Step 5: Check AI status after disabling
    console.log(
      "\n📋 Step 5: Checking AI status after disabling inbound AI..."
    );
    const aiStatusAfterDisable = await apiRequest(
      "GET",
      `/organizations/${organizationId}/ai-status`
    );

    console.log("📊 AI Status After Disabling:");
    console.log(`   Has AI Setup: ${aiStatusAfterDisable.aiSetup.hasSetup}`);

    if (aiStatusAfterDisable.aiSetup.hasSetup) {
      console.log(
        `   Setup Completed: ${aiStatusAfterDisable.aiSetup.setupCompleted}`
      );
      console.log(`   AI Status: ${aiStatusAfterDisable.aiSetup.status}`);
      console.log(
        `   Phone Number: ${
          aiStatusAfterDisable.aiSetup.phoneNumber || "Released"
        }`
      );
      console.log(
        `   Note: Phone number should be fully released from both VAPI and Twilio`
      );
    } else {
      console.log(
        `   Note: AI setup should be inactive and phone number released`
      );
    }

    // Step 6: Re-enable inbound AI (should reactivate existing phone number)
    console.log("\n📋 Step 6: Re-enabling inbound AI...");
    const reEnableResult = await apiRequest(
      "PUT",
      `/organizations/${organizationId}`,
      {
        inboundAi: true,
      }
    );

    console.log(`   ✅ Organization updated successfully`);
    console.log(`   InboundAi: ${reEnableResult.inboundAi}`);

    // Step 7: Final AI status check
    console.log("\n📋 Step 7: Final AI status check...");
    const finalAiStatus = await apiRequest(
      "GET",
      `/organizations/${organizationId}/ai-status`
    );

    console.log("📊 Final AI Status:");
    console.log(`   Has AI Setup: ${finalAiStatus.aiSetup.hasSetup}`);

    if (finalAiStatus.aiSetup.hasSetup) {
      console.log(
        `   Setup Completed: ${finalAiStatus.aiSetup.setupCompleted}`
      );
      console.log(`   AI Status: ${finalAiStatus.aiSetup.status}`);
      console.log(`   Phone Number: ${finalAiStatus.aiSetup.phoneNumber}`);
      console.log(
        `   Note: Should reuse existing assistants and have a new phone number`
      );
    }

    console.log("\n🎉 Inbound AI upgrade test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
};

// Test multiple organizations
const testMultipleOrganizations = async () => {
  try {
    console.log("\n🏢 Testing Multiple Organizations...\n");

    const organizationIds = [
      "ORG_ID_1_HERE", // Replace with actual organization IDs
      "ORG_ID_2_HERE",
      "ORG_ID_3_HERE",
    ];

    for (let i = 0; i < organizationIds.length; i++) {
      const orgId = organizationIds[i];
      console.log(`📋 Testing Organization ${i + 1}: ${orgId}`);

      try {
        // Get organization info
        const orgInfo = await apiRequest("GET", `/organizations/${orgId}`);
        console.log(`   Company: ${orgInfo.companyName || "N/A"}`);
        console.log(`   Current InboundAi: ${orgInfo.inboundAi}`);

        // Toggle inbound AI
        const newInboundAi = !orgInfo.inboundAi;
        console.log(`   Setting InboundAi to: ${newInboundAi}`);

        const updateResult = await apiRequest(
          "PUT",
          `/organizations/${orgId}`,
          {
            inboundAi: newInboundAi,
          }
        );

        console.log(`   ✅ Updated successfully`);

        // Check AI status
        const aiStatus = await apiRequest(
          "GET",
          `/organizations/${orgId}/ai-status`
        );
        console.log(`   Has AI Setup: ${aiStatus.aiSetup.hasSetup}`);

        if (aiStatus.aiSetup.hasSetup) {
          console.log(`   AI Status: ${aiStatus.aiSetup.status}`);
          console.log(`   Phone Number: ${aiStatus.aiSetup.phoneNumber}`);
        }

        console.log(""); // Empty line for readability
      } catch (error) {
        console.error(
          `   ❌ Error testing organization ${orgId}: ${error.message}`
        );
      }
    }

    console.log("🎉 Multiple organizations test completed!");
  } catch (error) {
    console.error("❌ Multiple organizations test failed:", error.message);
  }
};

// Test error handling
const testErrorHandling = async () => {
  try {
    console.log("\n⚠️ Testing Error Handling...\n");

    const invalidOrgId = "invalid_organization_id";

    console.log("📋 Testing with invalid organization ID...");
    try {
      await apiRequest("PUT", `/organizations/${invalidOrgId}`, {
        inboundAi: true,
      });
      console.log("   ❌ Should have failed with invalid ID");
    } catch (error) {
      console.log(
        `   ✅ Correctly failed: ${
          error.response?.data?.message || error.message
        }`
      );
    }

    console.log("\n📋 Testing with missing organization...");
    try {
      await apiRequest("PUT", "/organizations/507f1f77bcf86cd799439011", {
        inboundAi: true,
      });
      console.log("   ❌ Should have failed with non-existent organization");
    } catch (error) {
      console.log(
        `   ✅ Correctly failed: ${
          error.response?.data?.message || error.message
        }`
      );
    }

    console.log("\n🎉 Error handling test completed!");
  } catch (error) {
    console.error("❌ Error handling test failed:", error.message);
  }
};

// Main test runner
const runTests = async () => {
  console.log("🧪 Starting Inbound AI Upgrade Tests\n");
  console.log("=".repeat(60));

  await testInboundAIUpgrade();
  await testMultipleOrganizations();
  await testErrorHandling();

  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests completed!");
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testInboundAIUpgrade,
  testMultipleOrganizations,
  testErrorHandling,
  runTests,
};
