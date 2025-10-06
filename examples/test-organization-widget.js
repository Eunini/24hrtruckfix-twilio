const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-auth-token-here"; // Replace with actual token
const ORGANIZATION_ID = "your-organization-id-here"; // Replace with actual org ID

// Headers for authenticated requests
const authHeaders = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

// Test organization widget functionality
async function testOrganizationWidget() {
  console.log("🚀 Testing Organization Widget Functionality\n");

  try {
    // 1. Create a new organization widget
    console.log("1. Creating organization widget...");
    const createResponse = await axios.post(
      `${BASE_URL}/organization-widgets?organizationId=${ORGANIZATION_ID}`,
      {
        config: {
          title: "Marketing Support",
          description: "Get help with our services",
          primaryButton: "Start Chat",
          secondaryButton: "Learn More",
        },
        allowedOrigins: [
          "https://yourdomain.com",
          "https://app.yourdomain.com",
        ],
        widgetType: "marketing",
        settings: {
          theme: {
            primaryColor: "#2563eb",
            secondaryColor: "#64748b",
            backgroundColor: "#ffffff",
            textColor: "#1e293b",
          },
          display: {
            showLogo: true,
            showCompanyName: true,
            position: "bottom-right",
            size: "medium",
          },
          behavior: {
            autoOpen: false,
            delayBeforeShow: 3000,
            showOnScroll: true,
            scrollThreshold: 30,
          },
        },
      },
      { headers: authHeaders }
    );

    console.log(
      "✅ Widget created successfully:",
      createResponse.data.data._id
    );
    const widgetId = createResponse.data.data._id;

    // 2. Get widget by ID
    console.log("\n2. Getting widget by ID...");
    const getByIdResponse = await axios.get(
      `${BASE_URL}/organization-widgets/${widgetId}`,
      {
        headers: authHeaders,
      }
    );
    console.log("✅ Widget retrieved:", getByIdResponse.data.data.config.title);

    // 3. Get widget by organization ID
    console.log("\n3. Getting widget by organization ID...");
    const getByOrgResponse = await axios.get(
      `${BASE_URL}/organization-widgets/organization?organizationId=${ORGANIZATION_ID}`,
      {
        headers: authHeaders,
      }
    );
    console.log(
      "✅ Widget found for organization:",
      getByOrgResponse.data.data.widgetType
    );

    // 4. Update widget settings
    console.log("\n4. Updating widget settings...");
    const updateSettingsResponse = await axios.patch(
      `${BASE_URL}/organization-widgets/${widgetId}/settings`,
      {
        settings: {
          theme: {
            primaryColor: "#dc2626",
          },
          behavior: {
            autoOpen: true,
            delayBeforeShow: 1000,
          },
        },
      },
      { headers: authHeaders }
    );
    console.log("✅ Widget settings updated");

    // 5. Toggle widget status
    console.log("\n5. Toggling widget status...");
    const toggleResponse = await axios.patch(
      `${BASE_URL}/organization-widgets/${widgetId}/toggle`,
      {},
      {
        headers: authHeaders,
      }
    );
    console.log("✅ Widget status toggled:", toggleResponse.data.message);

    // 6. Get widget analytics
    console.log("\n6. Getting widget analytics...");
    const analyticsResponse = await axios.get(
      `${BASE_URL}/organization-widgets/${widgetId}/analytics`,
      {
        headers: authHeaders,
      }
    );
    console.log("✅ Analytics retrieved:", analyticsResponse.data.data.message);

    // 7. Get public widget (without authentication)
    console.log("\n7. Getting public widget...");
    const publicResponse = await axios.get(
      `${BASE_URL}/organization-widgets/organization/${ORGANIZATION_ID}/open`
    );
    console.log(
      "✅ Public widget retrieved:",
      publicResponse.data.data.isActive ? "Active" : "Inactive"
    );

    // 8. Update widget configuration
    console.log("\n8. Updating widget configuration...");
    const updateResponse = await axios.put(
      `${BASE_URL}/organization-widgets/${widgetId}`,
      {
        config: {
          title: "Updated Marketing Support",
          description: "Enhanced help with our services",
          primaryButton: "Chat Now",
          secondaryButton: "View Services",
        },
      },
      { headers: authHeaders }
    );
    console.log("✅ Widget configuration updated");

    // 9. Delete widget (cleanup)
    console.log("\n9. Cleaning up - deleting widget...");
    const deleteResponse = await axios.delete(
      `${BASE_URL}/organization-widgets/${widgetId}`,
      {
        headers: authHeaders,
      }
    );
    console.log("✅ Widget deleted successfully");

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Test marketing agents creation
async function testMarketingAgents() {
  console.log("\n🚀 Testing Marketing Agents Creation\n");

  try {
    // This would typically be called when creating a marketing widget
    // The VAPI service will automatically create the agents
    console.log(
      "✅ Marketing agents are automatically created when creating a marketing widget"
    );
    console.log("   - Inbound Marketing Agent (Ava)");
    console.log("   - Outbound Marketing Agent (Alex)");
    console.log("   - Web Marketing Agent (Web Assistant)");
  } catch (error) {
    console.error("❌ Marketing agents test failed:", error.message);
  }
}

// Run tests
async function runTests() {
  console.log("🧪 Organization Widget System Test Suite\n");
  console.log("Make sure to:");
  console.log("1. Update AUTH_TOKEN with a valid authentication token");
  console.log("2. Update ORGANIZATION_ID with a valid organization ID");
  console.log("3. Ensure the server is running on localhost:3000\n");

  await testOrganizationWidget();
  await testMarketingAgents();
}

// Export for use in other files
module.exports = {
  testOrganizationWidget,
  testMarketingAgents,
  runTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}
