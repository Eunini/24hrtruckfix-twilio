const fetch = require("node-fetch");

// Configuration
const BASE_URL = "http://localhost:3000/api/v1";
const AUTH_TOKEN = "your-auth-token-here"; // Replace with actual token

// Helper function to make API requests
async function makeRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`\n=== ${method} ${endpoint} ===`);
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error(`Error calling ${method} ${endpoint}:`, error);
    return null;
  }
}

// Test the new Google Maps provider endpoints
async function testGoogleMapsProviders() {
  console.log("🚀 Testing Google Maps Provider Endpoints\n");

  // 1. Test finding providers on Google Maps
  console.log("📍 Step 1: Finding providers on Google Maps...");
  const searchResult = await makeRequest(
    "POST",
    "/mechanics/find-google-maps",
    {
      address: "123 Main St, Los Angeles, CA",
      serviceType: "Towing, Roadside Assistance",
      radius: 10,
    }
  );

  if (!searchResult || !searchResult.success) {
    console.log("❌ Failed to search for providers");
    return;
  }

  const providers = searchResult.data;
  if (providers.length === 0) {
    console.log("❌ No providers found on Google Maps");
    return;
  }

  console.log(`✅ Found ${providers.length} providers on Google Maps`);

  // 2. Create a provider from Google Maps data
  console.log("\n🏗️ Step 2: Creating provider from Google Maps...");
  const googleProvider = providers[0]; // Use the first provider found

  const createResult = await makeRequest(
    "POST",
    "/mechanics/create-from-google-maps",
    {
      googleProvider: {
        name: googleProvider.name,
        address: googleProvider.address,
        phoneNumber: googleProvider.phoneNumber,
        rating: googleProvider.rating,
        businessType: googleProvider.businessType,
        placeId: googleProvider.placeId,
      },
      // Note: ticketId is optional - if provided, the provider will be assigned to that ticket
    }
  );

  if (!createResult || !createResult.success) {
    console.log("❌ Failed to create provider from Google Maps");
    return;
  }

  console.log("✅ Successfully created provider from Google Maps");
  const newProviderId = createResult.data.provider._id;

  // 3. Test assigning provider to a ticket (requires a valid ticket ID)
  console.log("\n🎫 Step 3: Testing provider assignment to ticket...");

  // First, let's try to get a ticket ID (this is just an example)
  // In a real scenario, you would have a valid ticket ID
  const ticketId = "64f1a2b3c4d5e6f7g8h9i0j3"; // Replace with actual ticket ID

  const assignResult = await makeRequest(
    "POST",
    `/tickets/${ticketId}/assign-provider`,
    {
      providerId: newProviderId,
    }
  );

  if (assignResult && assignResult.success) {
    console.log("✅ Successfully assigned provider to ticket");
  } else {
    console.log(
      "❌ Failed to assign provider to ticket (this is expected if ticket ID is invalid)"
    );
  }

  console.log("\n🎉 Google Maps Provider test completed!");
}

// Example of creating a provider and assigning to ticket in one step
async function testCreateAndAssignProvider() {
  console.log("\n🚀 Testing Create and Assign Provider in One Step\n");

  const ticketId = "64f1a2b3c4d5e6f7g8h9i0j3"; // Replace with actual ticket ID

  const result = await makeRequest(
    "POST",
    "/mechanics/create-from-google-maps",
    {
      googleProvider: {
        name: "24/7 Emergency Towing",
        address: "456 Service Ave, Los Angeles, CA 90001",
        phoneNumber: "+1-555-7890",
        rating: 4.2,
        businessType: "Towing Service",
        placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      },
      ticketId: ticketId, // This will assign the provider to the ticket automatically
    }
  );

  if (result && result.success) {
    console.log("✅ Successfully created provider and assigned to ticket");
    console.log("Provider ID:", result.data.provider._id);
    console.log("Assignment:", result.data.assignment);
  } else {
    console.log("❌ Failed to create and assign provider");
  }
}

// Run the tests
async function main() {
  console.log("🧪 Google Maps Provider API Test Suite");
  console.log("=====================================");

  // Note: Make sure to set a valid AUTH_TOKEN before running these tests
  if (AUTH_TOKEN === "your-auth-token-here") {
    console.log(
      "⚠️  Please set a valid AUTH_TOKEN in the script before running tests"
    );
    return;
  }

  await testGoogleMapsProviders();
  await testCreateAndAssignProvider();
}

// Export for use in other scripts
module.exports = {
  makeRequest,
  testGoogleMapsProviders,
  testCreateAndAssignProvider,
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
