#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MongoClient } from "mongodb";
import express from "express";
import cors from "cors";
import https from "https";
import fs from "fs";
import { z } from "zod";
import OpenAI from "openai";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "./server.key";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "./server.crt";

// MongoDB connection
const connectionString = process.env.MONGODB_URI;

let client;
let db;

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// HubSpot service will be initialized in main function
let HubSpotService;
let hubspotService;

// Initialize MongoDB connection
async function connectToMongoDB() {
  try {
    client = new MongoClient(connectionString);
    await client.connect();
    console.log("✅ Connected to MongoDB");

    // Auto-detect database
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    const userDbs = dbs.databases.filter(
      (d) => !["admin", "local", "config"].includes(d.name)
    );

    if (userDbs.length > 0) {
      db = client.db(userDbs[1].name);
      console.log(`📄 Using database: ${userDbs[1].name}`);
    } else {
      db = client.db("test");
      console.log("📄 Using default database: test");
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

  // Analyze each document
  documents.forEach((doc) => {
    analyzeObject(doc, "", fieldStats);
  });

  // Convert to simple format
  const schema = {};
  fieldStats.forEach((stats, fieldPath) => {
    // Get the most common type
    let mostCommonType = "unknown";
    let maxCount = 0;

    stats.types.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    });

    // Get unique examples (max 2)
    const uniqueExamples = [];
    const seenValues = new Set();

    for (const example of stats.examples) {
      const exampleStr = JSON.stringify(example);
      if (!seenValues.has(exampleStr) && uniqueExamples.length < 2) {
        uniqueExamples.push(example);
        seenValues.add(exampleStr);
      }
    }

    schema[fieldPath] = {
      type: mostCommonType,
      examples: uniqueExamples,
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
        seenValues: new Set(),
      });
    }

    const stats = fieldStats.get(fieldPath);
    const currentCount = stats.types.get(type) || 0;
    stats.types.set(type, currentCount + 1);

    // Store unique examples (max 2)
    const valueStr = JSON.stringify(value);
    if (!stats.seenValues.has(valueStr) && stats.examples.length < 2) {
      stats.examples.push(value);
      stats.seenValues.add(valueStr);
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

// Create Express app
const app = express();

// CORS configuration (simplified for testing)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    database: db ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Ask questions endpoint
app.post("/ask", async (req, res) => {
  try {
    const { question, model = "gpt-4o-mini" } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question is required",
        message: "Please provide a question in the request body",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key not configured",
        message: "Please set OPENAI_API_KEY environment variable",
      });
    }

    console.log("🤖 Processing question:", question);

    const response = await openaiClient.responses.create({
      model: model,
      parallel_tool_calls: true,
      truncation: "auto",
      tools: [
        {
          type: "mcp",
          server_label: "mongodb",
          server_url: "https://two4hourservice-backend-1.onrender.com/mcp", //`https://tidy-tetra-literate.ngrok-free.app/mcp`,
          require_approval: "never",
        },
      ],
      input: `
Current date: ${new Date().toISOString()}

Before running any queries or making any tool calls, always:
1. Identify all collections involved in the task.
2. Analyze the schema of **each collection individually** — including all fields, types, and relationships — even if you've already analyzed another.
3. Ensure all required fields for tool calls are correctly provided.
4. Only Analyze the collections that are involved in the task even if you have a list of all the collections 

Task:
${question}

Requirements:
- Do not skip schema analysis for any collection involved (e.g., policies, tickets, users,etc.).
- Validate the relationship between collections (e.g., how tickets are linked to policies).
- Accuracy is crucial — no document should be left out.

- When making a Query after analysis only retrive fields that you need not all the fields to save cost
- for comples queries use the aggregation pipeline if it fails then try using find

Reminder:
If a tool call requires any fields, make sure they are included and correctly filled.
`,
    });

    // - All query should be between the last 30 days

    res.json({
      success: true,
      question: question,
      output: response.output,
      output_text: response.output_text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Ask endpoint error:", error);
    res.status(500).json({
      error: "Failed to process question",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Stateless MCP endpoint
app.post("/mcp", async (req, res) => {
  try {
    // Create new instances for each request to ensure complete isolation
    const mcpServer = new McpServer({
      name: "mongodb-mcp-server",
      version: "1.0.0",
    });

    // Register MongoDB tools
    mcpServer.registerTool(
      "mongodb_find",
      {
        title: "MongoDB Find",
        description:
          "Find documents in a MongoDB collection with optional filtering, sorting, and limiting",
        inputSchema: {
          collection: z.string().describe("Collection name to query"),
          query: z
            .object({})
            .passthrough()
            .optional()
            .describe("MongoDB query filter (optional, defaults to {})"),
          limit: z
            .number()
            .min(1)
            .max(100)
            .default(10)
            .describe("Maximum number of documents to return (max 100)"),
          sort: z
            .object({})
            .passthrough()
            .optional()
            .describe(
              "Sort specification (optional, e.g., {'name': 1, 'age': -1})"
            ),
        },
      },
      async ({ collection, query = {}, limit = 10, sort = {} }) => {
        console.log("🔄 MCP -> HTTP: mongodb_find");
        if (!db) {
          throw new Error("Database connection not established");
        }

        try {
          let cursor = db.collection(collection).find(query);
          if (Object.keys(sort).length > 0) {
            cursor = cursor.sort(sort);
          }

          const documents = await cursor.limit(limit).toArray();

          return {
            content: [
              {
                type: "text",
                text: `Found ${
                  documents.length
                } documents in collection '${collection}':\n\n${JSON.stringify(
                  documents,
                  null,
                  2
                )}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing find: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    mcpServer.registerTool(
      "mongodb_aggregate",
      {
        title: "MongoDB Aggregate",
        description: "Execute aggregation pipeline on a MongoDB collection",
        inputSchema: {
          collection: z.string().describe("Collection name"),
          pipeline: z
            .array(z.object({}).passthrough())
            .describe("An array of aggregation stages to execute"),
        },
      },
      async ({ collection, pipeline }) => {
        console.log("🔄 MCP -> HTTP: mongodb_aggregate");
        if (!db) {
          throw new Error("Database connection not established");
        }

        try {
          if (!Array.isArray(pipeline)) {
            return {
              content: [
                {
                  type: "text",
                  text: "Pipeline must be an array",
                },
              ],
              isError: true,
            };
          }

          const aggResult = await db
            .collection(collection)
            .aggregate(pipeline)
            .toArray();

          return {
            content: [
              {
                type: "text",
                text: `Aggregation result for collection '${collection}' (${
                  aggResult.length
                } results):\n\n${JSON.stringify(aggResult, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing aggregation: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    mcpServer.registerTool(
      "mongodb_list_collections",
      {
        title: "List Collections",
        description: "List all collections in the database",
        inputSchema: {},
      },
      async () => {
        console.log("🔄 MCP -> HTTP: mongodb_list_collections");
        if (!db) {
          throw new Error("Database connection not established");
        }

        try {
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
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing collections: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    mcpServer.registerTool(
      "mongodb_count_documents",
      {
        title: "Count Documents",
        description: "Count documents in a collection with optional filter",
        inputSchema: {
          collection: z.string().describe("Collection name"),
          query: z
            .object({})
            .passthrough()
            .optional()
            .describe("Count filter (optional, defaults to {})"),
        },
      },
      async ({ collection, query = {} }) => {
        console.log("🔄 MCP -> HTTP: mongodb_count_documents");
        if (!db) {
          throw new Error("Database connection not established");
        }

        try {
          const count = await db.collection(collection).countDocuments(query);

          return {
            content: [
              {
                type: "text",
                text: `Document count in collection '${collection}': ${count.toLocaleString()}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error counting documents: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    mcpServer.registerTool(
      "mongodb_analyze_schema",
      {
        title: "Analyze Schema",
        description:
          "Analyze the schema structure of a collection by sampling documents",
        inputSchema: {
          collection: z.string().describe("Collection name to analyze"),
          sampleSize: z
            .number()
            .min(1)
            .max(1000)
            .default(100)
            .describe("Number of documents to sample for analysis (max 1000)"),
        },
      },
      async ({ collection, sampleSize = 100 }) => {
        console.log("🔄 MCP -> HTTP: mongodb_analyze_schema");
        if (!db) {
          throw new Error("Database connection not established");
        }

        try {
          // Split the sampleSize in half (rounded down and up)
          const half1 = Math.floor(sampleSize / 2);
          const half2 = sampleSize - half1;

          // Get the most recent documents (by _id descending)
          const newestDocs = await db
            .collection(collection)
            .find({})
            .sort({ _id: -1 })
            .limit(half1)
            .toArray();

          // Get the oldest documents (by _id ascending)
          const oldestDocs = await db
            .collection(collection)
            .find({})
            .sort({ _id: 1 })
            .limit(half2)
            .toArray();

          // Combine the two halves
          const sampleDocs = [...newestDocs, ...oldestDocs];

          if (sampleDocs.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Collection '${collection}' appears to be empty or does not exist.`,
                },
              ],
            };
          }

          const schema = analyzeDocumentSchema(sampleDocs);

          return {
            content: [
              {
                type: "text",
                text: `Schema analysis for collection '${collection}' (analyzed ${
                  sampleDocs.length
                } documents):\n\n${JSON.stringify(schema, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error analyzing schema: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Register HubSpot tools
    if (hubspotService) {
      mcpServer.registerTool(
        "hubspot_create_contact",
        {
          title: "Create HubSpot Contact",
          description: "Create a new contact in HubSpot CRM",
          inputSchema: {
            email: z.string().email().describe("Contact email address"),
            firstName: z.string().optional().describe("First name"),
            lastName: z.string().optional().describe("Last name"),
            phone: z.string().optional().describe("Phone number"),
            company: z.string().optional().describe("Company name"),
            jobTitle: z.string().optional().describe("Job title"),
            address: z.string().optional().describe("Street address"),
            city: z.string().optional().describe("City"),
            state: z.string().optional().describe("State/Province"),
            zip: z.string().optional().describe("ZIP/Postal code"),
            country: z.string().optional().describe("Country"),
            website: z.string().optional().describe("Website URL"),
            lifecycleStage: z.string().optional().describe("Lifecycle stage (e.g., lead, customer)"),
            leadStatus: z.string().optional().describe("Lead status"),
            customProperties: z.object({}).passthrough().optional().describe("Additional custom properties")
          },
        },
        async (contactData) => {
          console.log("🔄 MCP -> HTTP: hubspot_create_contact");
          try {
            const result = await hubspotService.createContact(contactData);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully created HubSpot contact:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error creating HubSpot contact: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_get_contact",
        {
          title: "Get HubSpot Contact",
          description: "Retrieve a contact from HubSpot by ID",
          inputSchema: {
            contactId: z.string().describe("HubSpot contact ID"),
          },
        },
        async ({ contactId }) => {
          console.log("🔄 MCP -> HTTP: hubspot_get_contact");
          try {
            const result = await hubspotService.getContact(contactId);
            return {
              content: [
                {
                  type: "text",
                  text: `HubSpot contact details:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error retrieving HubSpot contact: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_update_contact",
        {
          title: "Update HubSpot Contact",
          description: "Update an existing contact in HubSpot",
          inputSchema: {
            contactId: z.string().describe("HubSpot contact ID"),
            updateData: z.object({}).passthrough().describe("Contact properties to update"),
          },
        },
        async ({ contactId, updateData }) => {
          console.log("🔄 MCP -> HTTP: hubspot_update_contact");
          try {
            const result = await hubspotService.updateContact(contactId, updateData);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully updated HubSpot contact:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error updating HubSpot contact: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_delete_contact",
        {
          title: "Delete HubSpot Contact",
          description: "Delete a contact from HubSpot",
          inputSchema: {
            contactId: z.string().describe("HubSpot contact ID"),
          },
        },
        async ({ contactId }) => {
          console.log("🔄 MCP -> HTTP: hubspot_delete_contact");
          try {
            const result = await hubspotService.deleteContact(contactId);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted HubSpot contact with ID: ${contactId}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error deleting HubSpot contact: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
       );

      mcpServer.registerTool(
        "hubspot_create_task",
        {
          title: "Create HubSpot Task",
          description: "Create a new task in HubSpot CRM",
          inputSchema: {
            subject: z.string().describe("Task subject/title"),
            body: z.string().optional().describe("Task description/body"),
            status: z.string().optional().describe("Task status (NOT_STARTED, IN_PROGRESS, COMPLETED, WAITING, DEFERRED)"),
            priority: z.string().optional().describe("Task priority (LOW, MEDIUM, HIGH)"),
            dueDate: z.string().optional().describe("Due date in ISO format"),
            ownerId: z.string().optional().describe("HubSpot user ID who owns the task"),
            contactId: z.string().optional().describe("Associated contact ID"),
            companyId: z.string().optional().describe("Associated company ID"),
            dealId: z.string().optional().describe("Associated deal ID"),
            ticketId: z.string().optional().describe("Associated ticket ID"),
            customProperties: z.object({}).passthrough().optional().describe("Additional custom properties")
          },
        },
        async (taskData) => {
          console.log("🔄 MCP -> HTTP: hubspot_create_task");
          try {
            const result = await hubspotService.createTask(taskData);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully created HubSpot task:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error creating HubSpot task: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_get_task",
        {
          title: "Get HubSpot Task",
          description: "Retrieve a task from HubSpot by ID",
          inputSchema: {
            taskId: z.string().describe("HubSpot task ID"),
          },
        },
        async ({ taskId }) => {
          console.log("🔄 MCP -> HTTP: hubspot_get_task");
          try {
            const result = await hubspotService.getTask(taskId);
            return {
              content: [
                {
                  type: "text",
                  text: `HubSpot task details:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error retrieving HubSpot task: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_update_task",
        {
          title: "Update HubSpot Task",
          description: "Update an existing task in HubSpot",
          inputSchema: {
            taskId: z.string().describe("HubSpot task ID"),
            updateData: z.object({}).passthrough().describe("Task properties to update"),
          },
        },
        async ({ taskId, updateData }) => {
          console.log("🔄 MCP -> HTTP: hubspot_update_task");
          try {
            const result = await hubspotService.updateTask(taskId, updateData);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully updated HubSpot task:\n\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error updating HubSpot task: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );

      mcpServer.registerTool(
        "hubspot_delete_task",
        {
          title: "Delete HubSpot Task",
          description: "Delete a task from HubSpot",
          inputSchema: {
            taskId: z.string().describe("HubSpot task ID"),
          },
        },
        async ({ taskId }) => {
          console.log("🔄 MCP -> HTTP: hubspot_delete_task");
          try {
            const result = await hubspotService.deleteTask(taskId);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted HubSpot task with ID: ${taskId}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error deleting HubSpot task: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
     }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // No session management
    });

    // Clean up when request closes
    res.on("close", () => {
      console.log("🔚 Request closed");
      transport.close();
      mcpServer.close();
    });

    // Connect and handle request
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("❌ MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

// SSE notifications not supported in stateless mode
app.get("/mcp", async (req, res) => {
  console.log("📡 Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed - stateless mode",
      },
      id: null,
    })
  );
});

// Session termination not needed in stateless mode
app.delete("/mcp", async (req, res) => {
  console.log("📡 Received DELETE MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed - stateless mode",
      },
      id: null,
    })
  );
});

// API info endpoint
app.get("/", (req, res) => {
  res.json({
    name: "MongoDB MCP Server",
    version: "1.0.0",
    endpoints: {
      mcp: "/mcp",
      health: "/health",
      ask: "/ask",
    },
    tools: [
      "mongodb_find",
      "mongodb_aggregate",
      "mongodb_list_collections",
      "mongodb_count_documents",
      "mongodb_analyze_schema",
      "hubspot_create_contact",
      "hubspot_get_contact",
      "hubspot_update_contact",
      "hubspot_delete_contact",
      "hubspot_create_task",
      "hubspot_get_task",
      "hubspot_update_task",
      "hubspot_delete_task",
    ],
    usage: {
      ask: {
        method: "POST",
        body: {
          question: "Your question here",
          model: "gpt-4o-mini (optional)",
        },
        example: {
          question: "List 100 mechanics in the system",
        },
      },
    },
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Express error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

// Start servers
async function main() {
  // Initialize HubSpot service with dynamic import
  try {
    const hubspotModule = await import("../src/services/hubspot.service.js");
    HubSpotService = hubspotModule.default;
    hubspotService = new HubSpotService();
    console.log("✅ HubSpot service initialized");
  } catch (error) {
    console.warn("⚠️ HubSpot service not available:", error.message);
  }

  await connectToMongoDB();

  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`🚀 HTTP server running on port ${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
  });

  // Start HTTPS server if SSL certificates exist
  if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
    try {
      const privateKey = fs.readFileSync(SSL_KEY_PATH, "utf8");
      const certificate = fs.readFileSync(SSL_CERT_PATH, "utf8");
      const credentials = { key: privateKey, cert: certificate };

      const httpsServer = https.createServer(credentials, app);
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`🔒 HTTPS server running on port ${HTTPS_PORT}`);
        console.log(
          `📡 Secure MCP endpoint: https://localhost:${HTTPS_PORT}/mcp`
        );
      });
    } catch (error) {
      console.warn("⚠️ HTTPS server failed to start:", error.message);
      console.log("💡 Generate SSL certificates or use HTTP only");
    }
  } else {
    console.log("💡 SSL certificates not found. To enable HTTPS:");
    console.log(
      "   openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes"
    );
  }

  console.log("✅ Available tools:");
  console.log("   • mongodb_find - Query documents");
  console.log("   • mongodb_aggregate - Run aggregation pipelines");
  console.log("   • mongodb_list_collections - List all collections");
  console.log("   • mongodb_count_documents - Count documents");
  console.log("   • mongodb_analyze_schema - Analyze collection schemas");
  if (hubspotService) {
    console.log("   • hubspot_create_contact - Create HubSpot contacts");
    console.log("   • hubspot_get_contact - Retrieve HubSpot contacts");
    console.log("   • hubspot_update_contact - Update HubSpot contacts");
    console.log("   • hubspot_delete_contact - Delete HubSpot contacts");
    console.log("   • hubspot_create_task - Create HubSpot tasks");
    console.log("   • hubspot_get_task - Retrieve HubSpot tasks");
    console.log("   • hubspot_update_task - Update HubSpot tasks");
    console.log("   • hubspot_delete_task - Delete HubSpot tasks");
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  if (client) {
    await client.close();
    console.log("📦 MongoDB connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down...");
  if (client) {
    await client.close();
    console.log("📦 MongoDB connection closed");
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Server error:", error);
  process.exit(1);
});
