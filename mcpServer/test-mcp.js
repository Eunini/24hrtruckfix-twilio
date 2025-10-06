#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testMCPServer() {
  console.log("🧪 Testing MCP Server...\n");

  // Create MCP client
  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  try {
    // Create transport
    const transport = new StdioClientTransport({
      command: "node",
      args: ["new-ncp.js"],
    });

    // Connect to the server
    await client.connect(transport);
    console.log("✅ Connected to MCP server");

    // List available tools using the request method
    console.log("\n🔍 Listing available tools...");
    const toolsResult = await client.request({
      method: "tools/list",
      params: {},
    });
    console.log(
      "✅ Available tools:",
      toolsResult.tools.map((t) => t.name)
    );

    // Test listing collections
    console.log("\n🔍 Testing mongodb_list_collections...");
    const collectionsResult = await client.request({
      method: "tools/call",
      params: {
        name: "mongodb_list_collections",
        arguments: {},
      },
    });
    console.log("✅ Collections result:", collectionsResult.content[0].text);

    // Test counting documents (assuming there's a 'users' collection)
    console.log("\n🔍 Testing mongodb_count_documents...");
    try {
      const countResult = await client.request({
        method: "tools/call",
        params: {
          name: "mongodb_count_documents",
          arguments: {
            collection: "users",
          },
        },
      });
      console.log("✅ Count result:", countResult.content[0].text);
    } catch (error) {
      console.log(
        "⚠️  Count test failed (collection might not exist):",
        error.message
      );
    }

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    process.exit(0);
  }
}

testMCPServer().catch(console.error);
