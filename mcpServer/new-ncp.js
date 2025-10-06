#!/usr/bin/env node

import {
  createServer,
  ServerTransport,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MongoClient } from "mongodb";

// MongoDB connection
const connectionString = process.env.MONGODB_URI || process.env.AI_MONGODB_URI;
let client;
let db;

// Initialize MongoDB connection
async function connectToMongoDB() {
  try {
    client = new MongoClient(connectionString);
    await client.connect();
    console.error("✅ Connected to MongoDB");

    // Auto-detect database
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    const userDbs = dbs.databases.filter(
      (d) => !["admin", "local", "config"].includes(d.name)
    );

    if (userDbs.length > 0) {
      db = client.db(userDbs[0].name);
      console.error(`📄 Using database: ${userDbs[0].name}`);
    } else {
      db = client.db("test");
      console.error("📄 Using default database: test");
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
}

// Schema analysis helper
function analyzeDocumentSchema(documents) {
  if (!documents.length) return {};

  const fieldStats = new Map();
  const totalDocs = documents.length;

  // Analyze each document
  documents.forEach((doc) => {
    analyzeObject(doc, "", fieldStats);
  });

  // Convert to readable format
  const schema = {};
  fieldStats.forEach((stats, fieldPath) => {
    const typeDistribution = {};
    let totalOccurrences = 0;

    stats.types.forEach((count, type) => {
      typeDistribution[type] = {
        count,
        percentage: Math.round((count / totalDocs) * 100),
      };
      totalOccurrences += count;
    });

    schema[fieldPath] = {
      presence: Math.round((totalOccurrences / totalDocs) * 100),
      types: typeDistribution,
      examples: stats.examples.slice(0, 3), // Show up to 3 examples
    };
  });

  return schema;
}

function analyzeObject(obj, prefix, fieldStats) {
  if (obj === null || obj === undefined) return;

  Object.entries(obj).forEach(([key, value]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const type = getFieldType(value);

    if (!fieldStats.has(fieldPath)) {
      fieldStats.set(fieldPath, {
        types: new Map(),
        examples: [],
      });
    }

    const stats = fieldStats.get(fieldPath);
    const currentCount = stats.types.get(type) || 0;
    stats.types.set(type, currentCount + 1);

    // Store examples (limit to avoid memory issues)
    if (stats.examples.length < 3) {
      stats.examples.push(value);
    }

    // Recursively analyze nested objects (limit depth)
    if (type === "object" && value !== null && prefix.split(".").length < 3) {
      analyzeObject(value, fieldPath, fieldStats);
    } else if (
      type === "array" &&
      Array.isArray(value) &&
      value.length > 0 &&
      prefix.split(".").length < 2
    ) {
      // Analyze first few array elements
      value.slice(0, 3).forEach((item, index) => {
        analyzeObject(item, `${fieldPath}[${index}]`, fieldStats);
      });
    }
  });
}

function getFieldType(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (
    value &&
    typeof value === "object" &&
    value.constructor?.name === "ObjectId"
  )
    return "objectId";
  if (typeof value === "object") return "object";
  return typeof value;
}

// Create MCP server
const server = createServer({
  name: "mongodb-mcp-server",
  version: "1.0.0",
});

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "mongodb_find",
        description:
          "Find documents in a MongoDB collection with optional filtering, sorting, and limiting",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Collection name to query",
            },
            query: {
              type: "object",
              description: "MongoDB query filter (optional, defaults to {})",
              default: {},
            },
            limit: {
              type: "integer",
              description: "Maximum number of documents to return (max 100)",
              default: 10,
              minimum: 1,
              maximum: 100,
            },
            sort: {
              type: "object",
              description:
                "Sort specification (optional, e.g., {'name': 1, 'age': -1})",
            },
          },
          required: ["collection"],
        },
      },
      {
        name: "mongodb_aggregate",
        description: "Execute aggregation pipeline on a MongoDB collection",
        inputSchema: {
          type: "object",
          properties: {
            pipeline: {
              type: "array",
              items: { type: "object", additionalProperties: {} },
              description: "An array of aggregation stages to execute",
            },
            collection: {
              type: "string",
              description: "Collection name",
            },
          },
          required: ["pipeline", "collection"],
        },
      },
      {
        name: "mongodb_list_collections",
        description: "List all collections in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "mongodb_count_documents",
        description: "Count documents in a collection with optional filter",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Collection name",
            },
            query: {
              type: "object",
              description: "Count filter (optional, defaults to {})",
              default: {},
            },
          },
          required: ["collection"],
        },
      },
      {
        name: "mongodb_analyze_schema",
        description:
          "Analyze the schema structure of a collection by sampling documents",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Collection name to analyze",
            },
            sampleSize: {
              type: "integer",
              description:
                "Number of documents to sample for analysis (max 1000)",
              default: 100,
              minimum: 1,
              maximum: 1000,
            },
          },
          required: ["collection"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!db) {
    throw new Error("Database connection not established");
  }

  console.error(`🔄 MCP Tool Call: ${name}`, JSON.stringify(args, null, 2));

  switch (name) {
    case "mongodb_find": {
      const query = args.query || {};
      const limit = Math.min(Math.max(args.limit || 10, 1), 100);
      const sort = args.sort || {};

      let cursor = db.collection(args.collection).find(query);
      if (Object.keys(sort).length > 0) {
        cursor = cursor.sort(sort);
      }

      const documents = await cursor.limit(limit).toArray();

      return {
        content: [
          {
            type: "text",
            text: `Found ${documents.length} documents in collection '${
              args.collection
            }':\n\n${JSON.stringify(documents, null, 2)}`,
          },
        ],
      };
    }

    case "mongodb_aggregate": {
      const pipeline = args.pipeline;
      if (!pipeline) {
        return {
          content: [
            {
              type: "text",
              text: `Pipeline is required. example: [{"$match": {"status": "active"}}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]`,
            },
          ],
        };
      }

      if (!Array.isArray(pipeline)) {
        return {
          content: [
            {
              type: "text",
              text: "Pipeline must be an array",
            },
          ],
        };
      }

      const aggResult = await db
        .collection(args.collection)
        .aggregate(pipeline)
        .toArray();

      return {
        content: [
          {
            type: "text",
            text: `Aggregation result for collection '${args.collection}' (${
              aggResult.length
            } results):\n\n${JSON.stringify(aggResult, null, 2)}`,
          },
        ],
      };
    }

    case "mongodb_list_collections": {
      const collections = await db.listCollections().toArray();
      const collectionInfo = collections.map((c) => ({
        name: c.name,
        type: c.type,
        options: c.options,
      }));

      return {
        content: [
          {
            type: "text",
            text: `Collections in database '${
              db.databaseName
            }':\n\n${collectionInfo
              .map((c) => `• ${c.name} (${c.type || "collection"})`)
              .join("\n")}\n\nTotal: ${collectionInfo.length} collections`,
          },
        ],
      };
    }

    case "mongodb_count_documents": {
      const query = args.query || {};
      const count = await db.collection(args.collection).countDocuments(query);

      return {
        content: [
          {
            type: "text",
            text: `Document count in collection '${
              args.collection
            }': ${count.toLocaleString()}`,
          },
        ],
      };
    }

    case "mongodb_analyze_schema": {
      const sampleSize = Math.min(Math.max(args.sampleSize || 100, 1), 1000);
      const sampleDocs = await db
        .collection(args.collection)
        .aggregate([{ $sample: { size: sampleSize } }])
        .toArray();

      if (sampleDocs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Collection '${args.collection}' appears to be empty or does not exist.`,
            },
          ],
        };
      } else {
        const schema = analyzeDocumentSchema(sampleDocs);

        return {
          content: [
            {
              type: "text",
              text: `Schema analysis for collection '${
                args.collection
              }' (analyzed ${sampleDocs.length} documents):\n\n${JSON.stringify(
                schema,
                null,
                2
              )}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  await connectToMongoDB();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("�� MongoDB MCP Server started");
  console.error("📡 Ready for OpenAI integration");
  console.error("✅ Available tools:");
  console.error("   • mongodb_find - Query documents");
  console.error("   • mongodb_aggregate - Run aggregation pipelines");
  console.error("   • mongodb_list_collections - List all collections");
  console.error("   • mongodb_count_documents - Count documents");
  console.error("   • mongodb_analyze_schema - Analyze collection schemas");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("\n🛑 Shutting down...");
  if (client) {
    await client.close();
    console.error("📦 MongoDB connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("\n🛑 Shutting down...");
  if (client) {
    await client.close();
    console.error("📦 MongoDB connection closed");
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Server error:", error);
  process.exit(1);
});
