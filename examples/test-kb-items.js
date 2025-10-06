const axios = require("axios");

// Base URL for the API
const BASE_URL = "http://localhost:3000/api/v1/kb-items";

// Sample data for testing
const sampleKbItems = [
  {
    type: "file",
    key: "documents/repair-manual-2024.pdf",
    title: "Truck Repair Manual 2024",
    organization: "507f1f77bcf86cd799439011", // Sample organization ID
    description: "Comprehensive repair manual for all truck models",
    tags: ["repair", "manual", "truck", "2024"],
  },
  {
    type: "url",
    key: "https://www.truckparts.com/brake-system-guide",
    title: "Brake System Maintenance Guide",
    mechanic: "507f1f77bcf86cd799439012", // Sample mechanic ID
    description: "Online guide for brake system maintenance",
    tags: ["brake", "maintenance", "guide", "online"],
  },
  {
    type: "file",
    key: "documents/engine-specs.pdf",
    title: "Engine Specifications Database",
    organization: "507f1f77bcf86cd799439011",
    description: "Database of engine specifications for various truck models",
    tags: ["engine", "specifications", "database", "truck"],
  },
  {
    type: "url",
    key: "https://www.trucking.com/tire-pressure-chart",
    title: "Tire Pressure Chart",
    mechanic: "507f1f77bcf86cd799439012",
    description: "Comprehensive tire pressure chart for different truck types",
    tags: ["tire", "pressure", "chart", "truck"],
  },
];

// Test functions
async function testCreateKbItem(itemData) {
  try {
    console.log("\n🔧 Creating kbItem:", itemData.title);
    const response = await axios.post(BASE_URL, itemData, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Created successfully:", response.data);
    return response.data.data._id;
  } catch (error) {
    console.error("❌ Creation failed:", error.response?.data || error.message);
    return null;
  }
}

async function testGetKbItems() {
  try {
    console.log("\n📋 Getting all kbItems...");
    const response = await axios.get(BASE_URL, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
      },
    });
    console.log("✅ Retrieved successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error(
      "❌ Retrieval failed:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function testGetKbItemById(id) {
  try {
    console.log(`\n🔍 Getting kbItem by ID: ${id}`);
    const response = await axios.get(`${BASE_URL}/${id}`, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
      },
    });
    console.log("✅ Retrieved successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error(
      "❌ Retrieval failed:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function testUpdateKbItem(id, updateData) {
  try {
    console.log(`\n✏️ Updating kbItem: ${id}`);
    const response = await axios.put(`${BASE_URL}/${id}`, updateData, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Updated successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error("❌ Update failed:", error.response?.data || error.message);
    return null;
  }
}

async function testDeleteKbItem(id) {
  try {
    console.log(`\n🗑️ Deleting kbItem: ${id}`);
    const response = await axios.delete(`${BASE_URL}/${id}`, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
      },
    });
    console.log("✅ Deleted successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error("❌ Deletion failed:", error.response?.data || error.message);
    return null;
  }
}

async function testGetKbItemsByOrganization(organizationId) {
  try {
    console.log(`\n🏢 Getting kbItems by organization: ${organizationId}`);
    const response = await axios.get(
      `${BASE_URL}/organization/${organizationId}`,
      {
        headers: {
          Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
        },
      }
    );
    console.log("✅ Retrieved successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error(
      "❌ Retrieval failed:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function testGetKbItemsByMechanic(mechanicId) {
  try {
    console.log(`\n🔧 Getting kbItems by mechanic: ${mechanicId}`);
    const response = await axios.get(`${BASE_URL}/mechanic/${mechanicId}`, {
      headers: {
        Authorization: "Bearer YOUR_AUTH_TOKEN_HERE", // Replace with actual token
      },
    });
    console.log("✅ Retrieved successfully:", response.data);
    return response.data.data;
  } catch (error) {
    console.error(
      "❌ Retrieval failed:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Main test function
async function runTests() {
  console.log("🚀 Starting kbItems API Tests...\n");

  const createdIds = [];

  // Test creating kbItems
  for (const item of sampleKbItems) {
    const id = await testCreateKbItem(item);
    if (id) {
      createdIds.push(id);
    }
  }

  // Test getting all kbItems
  await testGetKbItems();

  // Test getting kbItem by ID
  if (createdIds.length > 0) {
    await testGetKbItemById(createdIds[0]);

    // Test updating kbItem
    await testUpdateKbItem(createdIds[0], {
      title: "Updated Title",
      description: "This has been updated",
    });

    // Test getting by organization
    await testGetKbItemsByOrganization("507f1f77bcf86cd799439011");

    // Test getting by mechanic
    await testGetKbItemsByMechanic("507f1f77bcf86cd799439012");

    // Test deleting kbItem
    await testDeleteKbItem(createdIds[0]);
  }

  console.log("\n✨ All tests completed!");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCreateKbItem,
  testGetKbItems,
  testGetKbItemById,
  testUpdateKbItem,
  testDeleteKbItem,
  testGetKbItemsByOrganization,
  testGetKbItemsByMechanic,
  sampleKbItems,
};
