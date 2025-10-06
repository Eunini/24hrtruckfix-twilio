#!/usr/bin/env node

import express from "express";
import { spawn } from "child_process";
import cors from "cors";
import { EventEmitter } from "events";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

class MCPBridge extends EventEmitter {
  constructor() {
    super();
    this.mcpProcess = null;
    this.isReady = false;
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestId = 1;

    this.startMCPServer();
  }

  startMCPServer() {
    console.log("🚀 Starting official MongoDB MCP server...");

    // Handle Windows npx path issues
    const isWindows = process.platform === "win32";
    const npxCommand = isWindows ? "npx.cmd" : "npx";

    // Start the official MongoDB MCP server with stdio
    this.mcpProcess = spawn(
      npxCommand,
      [
        "-y",
        "mongodb-mcp-server",
        "--connectionString",
        process.env.MONGODB_URI || process.env.AI_MONGODB_URI,
        "--telemetry",
        "disabled",
        "--readOnly",
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        shell: isWindows,
      }
    );

    let buffer = "";

    // Handle stdout (MCP responses)
    this.mcpProcess.stdout.on("data", (data) => {
      buffer += data.toString();

      // Split by newlines and process complete JSON messages
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      lines.forEach((line) => {
        line = line.trim();
        if (line) {
          try {
            const message = JSON.parse(line);
            this.handleMCPResponse(message);
          } catch (error) {
            console.log("📥 Non-JSON output:", line);
          }
        }
      });
    });

    // Handle stderr (logs)
    this.mcpProcess.stderr.on("data", (data) => {
      const output = data.toString().trim();
      if (output.includes("Server started") || output.includes("Connected")) {
        console.log("✅ MCP Server:", output);
        this.isReady = true;
        this.emit("ready");
      } else {
        console.log("📋 MCP Log:", output);
      }
    });

    // Handle process events
    this.mcpProcess.on("error", (error) => {
      console.error("❌ MCP Process Error:", error);
      this.emit("error", error);
    });

    this.mcpProcess.on("exit", (code, signal) => {
      console.log(`🛑 MCP Process exited with code ${code}, signal ${signal}`);
      this.isReady = false;
      // Restart after a delay
      setTimeout(() => this.startMCPServer(), 2000);
    });

    // Initialize the MCP server
    setTimeout(() => {
      this.sendToMCP({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "mcp-bridge",
            version: "1.0.0",
          },
        },
      });
    }, 1000);
  }

  sendToMCP(message) {
    if (this.mcpProcess && this.mcpProcess.stdin) {
      const jsonMessage = JSON.stringify(message) + "\n";
      console.log("📤 Sending to MCP:", JSON.stringify(message, null, 2));
      this.mcpProcess.stdin.write(jsonMessage);
      if (!this.isReady) {
        this.isReady = true;
      }
      return true;
    }
    return false;
  }

  handleMCPResponse(message) {
    console.log("📨 Received from MCP:", JSON.stringify(message, null, 2));

    // Handle notifications
    if (message.method === "notifications/message") {
      console.log("🔔 MCP Notification:", message.params);
      return;
    }

    // Handle responses to our requests
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    }
  }

  async callMCP(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const message = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      // Store the promise resolver
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000); // 30 second timeout

      // Clear timeout when resolved
      const originalResolve = resolve;
      const wrappedResolve = (result) => {
        clearTimeout(timeout);
        originalResolve(result);
      };
      this.pendingRequests.set(id, { resolve: wrappedResolve, reject });

      // Send the request
      if (!this.sendToMCP(message)) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(new Error("Failed to send message to MCP server"));
      }
    });
  }

  async waitForReady() {
    if (this.isReady) return;
    return new Promise((resolve) => {
      this.once("ready", resolve);
    });
  }

  shutdown() {
    if (this.mcpProcess) {
      this.mcpProcess.kill("SIGTERM");
    }
  }
}

// Create bridge instance
const mcpBridge = new MCPBridge();

// MCP HTTP endpoints
app.get("/mcp", async (req, res) => {
  try {
    await mcpBridge.waitForReady();

    // Return MCP server capabilities
    res.json({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: ["tools/list"],
        },
        serverInfo: {
          name: "mongodb-mcp-bridge",
          version: "1.0.0",
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error.message,
      },
    });
  }
});

app.post("/mcp", async (req, res) => {
  try {
    console.log(req.body);
    const { method, params, id } = req.body;

    console.log(`🔄 HTTP -> MCP: ${method}`);
    await mcpBridge.waitForReady();

    console.log("mcpBridge.isReady", mcpBridge.isReady);

    let response;
    // Forward the request to MCP server
    if (method === "tools") {
      console.log("🔄 MCP -> HTTP: initialize");
      response = await mcpBridge.callMCP("tools/list");
    } else {
      response = await mcpBridge.callMCP(method, params);
    }

    // Return the response with the original request ID
    const httpResponse = {
      jsonrpc: "2.0",
      id: id || response.id,
    };

    if (response.result) {
      httpResponse.result = response.result;
    } else if (response.error) {
      httpResponse.error = response.error;
    }

    res.json(httpResponse);
  } catch (error) {
    console.error("Bridge Error:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id,
      error: {
        code: -32603,
        message: error.message,
      },
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    mcpReady: mcpBridge.isReady,
    pendingRequests: mcpBridge.pendingRequests.size,
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint to verify MCP communication
app.get("/test", async (req, res) => {
  try {
    await mcpBridge.waitForReady();

    // Test tools/list
    const toolsResponse = await mcpBridge.callMCP("tools/list");

    res.json({
      success: true,
      mcpResponse: toolsResponse,
      availableTools: toolsResponse.result?.tools?.map((t) => t.name) || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Express Error:", error);
  res.status(500).json({
    jsonrpc: "2.0",
    error: {
      code: -32603,
      message: "Internal server error",
    },
  });
});

// Start the bridge server
app.listen(PORT, () => {
  console.log(`🌉 MCP Bridge Server running on http://localhost:${PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log("\n✅ Ready for OpenAI MCP integration!");
  console.log("\n🔗 Bridging HTTP ↔ stdio with official MongoDB MCP server");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down bridge server...");
  mcpBridge.shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down bridge server...");
  mcpBridge.shutdown();
  process.exit(0);
});
