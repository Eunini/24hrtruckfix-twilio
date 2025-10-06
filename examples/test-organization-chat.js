const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-auth-token-here"; // Replace with actual token
const ORGANIZATION_ID = "your-organization-id-here"; // Replace with actual org ID
const MECHANIC_ID = "your-mechanic-id-here"; // Replace with actual mechanic ID

// Headers for authenticated requests
const authHeaders = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

// Test organization chat functionality
async function testOrganizationChat() {
  console.log("🚀 Testing Organization Chat Functionality\n");

  try {
    // 1. Create a new organization chat thread
    console.log("1. Creating organization chat thread...");
    const createOrgThreadResponse = await axios.post(
      `${BASE_URL}/chat/threads`,
      {
        organizationId: ORGANIZATION_ID,
        title: "Organization Support Chat",
        initialMessage: "Hello, I need help with your services",
        isOrg: true,
      },
      { headers: authHeaders }
    );

    console.log(
      "✅ Organization chat thread created:",
      createOrgThreadResponse.data.data.id
    );
    const orgThreadId = createOrgThreadResponse.data.data.id;

    // 2. Create a new mechanic chat thread (for comparison)
    console.log("\n2. Creating mechanic chat thread...");
    const createMechThreadResponse = await axios.post(
      `${BASE_URL}/chat/threads`,
      {
        mechanicId: MECHANIC_ID,
        title: "Mechanic Support Chat",
        initialMessage: "Hello, I need help with my vehicle",
        isOrg: false,
      },
      { headers: authHeaders }
    );

    console.log(
      "✅ Mechanic chat thread created:",
      createMechThreadResponse.data.data.id
    );
    const mechThreadId = createMechThreadResponse.data.data.id;

    // 3. Get organization chat threads
    console.log("\n3. Getting organization chat threads...");
    const getOrgThreadsResponse = await axios.get(
      `${BASE_URL}/chat/threads?isOrg=true&organizationId=${ORGANIZATION_ID}`,
      {
        headers: authHeaders,
      }
    );
    console.log(
      "✅ Organization chat threads retrieved:",
      getOrgThreadsResponse.data.data.length,
      "threads"
    );

    // 4. Get mechanic chat threads
    console.log("\n4. Getting mechanic chat threads...");
    const getMechThreadsResponse = await axios.get(
      `${BASE_URL}/chat/threads?isOrg=false&mechanicId=${MECHANIC_ID}`,
      {
        headers: authHeaders,
      }
    );
    console.log(
      "✅ Mechanic chat threads retrieved:",
      getMechThreadsResponse.data.data.length,
      "threads"
    );

    // 5. Send a message to organization chat
    console.log("\n5. Sending message to organization chat...");
    const sendOrgMessageResponse = await axios.post(
      `${BASE_URL}/chat/threads/${orgThreadId}/messages`,
      {
        content: "Can you tell me more about your pricing?",
      },
      { headers: authHeaders }
    );
    console.log("✅ Message sent to organization chat");

    // 6. Send a message to mechanic chat
    console.log("\n6. Sending message to mechanic chat...");
    const sendMechMessageResponse = await axios.post(
      `${BASE_URL}/chat/threads/${mechThreadId}/messages`,
      {
        content: "What services do you offer?",
      },
      { headers: authHeaders }
    );
    console.log("✅ Message sent to mechanic chat");

    // 7. Get messages from organization chat
    console.log("\n7. Getting organization chat messages...");
    const getOrgMessagesResponse = await axios.get(
      `${BASE_URL}/chat/threads/${orgThreadId}/messages`,
      {
        headers: authHeaders,
      }
    );
    console.log(
      "✅ Organization chat messages retrieved:",
      getOrgMessagesResponse.data.transcript_object?.length || 0,
      "messages"
    );

    // 8. Get messages from mechanic chat
    console.log("\n8. Getting mechanic chat messages...");
    const getMechMessagesResponse = await axios.get(
      `${BASE_URL}/chat/threads/${mechThreadId}/messages`,
      {
        headers: authHeaders,
      }
    );
    console.log(
      "✅ Mechanic chat messages retrieved:",
      getMechMessagesResponse.data.transcript_object?.length || 0,
      "messages"
    );

    // 9. Clean up - delete both chat threads
    console.log("\n9. Cleaning up - deleting chat threads...");
    await axios.delete(`${BASE_URL}/chat/threads/${orgThreadId}`, {
      headers: authHeaders,
    });
    await axios.delete(`${BASE_URL}/chat/threads/${mechThreadId}`, {
      headers: authHeaders,
    });
    console.log("✅ Chat threads deleted successfully");

    console.log("\n🎉 All organization chat tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Test webhook organization support
async function testWebhookOrganizationSupport() {
  console.log("\n🚀 Testing Webhook Organization Support\n");

  try {
    // Test organization web call creation
    console.log("1. Testing organization web call creation...");
    const orgWebCallResponse = await axios.post(
      `${BASE_URL}/webhook/web-call?organizationId=${ORGANIZATION_ID}&isOrg=true`
    );
    console.log("✅ Organization web call response:", orgWebCallResponse.data);

    // Test mechanic web call creation
    console.log("\n2. Testing mechanic web call creation...");
    const mechWebCallResponse = await axios.post(
      `${BASE_URL}/webhook/web-call?mechanicId=${MECHANIC_ID}&isOrg=false`
    );
    console.log("✅ Mechanic web call response:", mechWebCallResponse.data);

    console.log("\n🎉 Webhook organization support tests completed!");
  } catch (error) {
    console.error(
      "❌ Webhook test failed:",
      error.response?.data || error.message
    );
  }
}

// Run tests
async function runTests() {
  console.log("🧪 Organization Chat System Test Suite\n");
  console.log("Make sure to:");
  console.log("1. Update AUTH_TOKEN with a valid authentication token");
  console.log("2. Update ORGANIZATION_ID with a valid organization ID");
  console.log("3. Update MECHANIC_ID with a valid mechanic ID");
  console.log("4. Ensure the server is running on localhost:3000\n");

  await testOrganizationChat();
  await testWebhookOrganizationSupport();
}

// Export for use in other files
module.exports = {
  testOrganizationChat,
  testWebhookOrganizationSupport,
  runTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}
