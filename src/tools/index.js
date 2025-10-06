const mongoose = require("mongoose");
const { Type } = require("@google/genai");
const AppointmentBookingTool = require("./appointmentBooking");
const axios = require("axios");

/**
 * Tool registry to manage all available tools for the chat service
 */
class ToolRegistry {
  constructor() {
    this.tools = [];
  }

  /**
   * Register a new tool
   */
  registerTool(tool) {
    // Check if tool with same name already exists
    const existingToolIndex = this.tools.findIndex((t) => t.name === tool.name);
    if (existingToolIndex >= 0) {
      // Replace existing tool
      this.tools[existingToolIndex] = tool;
    } else {
      // Add new tool
      this.tools.push(tool);
    }
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools.find((tool) => tool.name === name);
  }

  /**
   * Get all registered tools
   */
  getAllTools() {
    return this.tools;
  }

  /**
   * Get all registered function declarations for tools
   */
  getToolFunctionDeclarations() {
    return this.tools.map((tool) => tool.functionDeclaration);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName, params, mechanicId) {
    const tool = this.getTool(toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    return await tool.execute(params, mechanicId);
  }

  /**
   * Initialize with the default set of tools
   */
  registerDefaultTools() {
    // Register Knowledge Base search tool
    this.registerTool({
      name: "knowledge_base_search",
      description:
        "Search the knowledge base for relevant information about the mechanic",
      functionDeclaration: {
        name: "knowledge_base_search",
        description:
          "Search the knowledge base for information related to the query if it's about the mechanic",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: "The query to search for in the knowledge base",
            },
            limit: {
              type: Type.NUMBER,
              description:
                "Maximum number of results to return, a good range is 3 and above.",
            },
          },
          required: ["query"],
        },
      },
      execute: async (params, mechanicId) => {
        if (!mechanicId) {
          throw new Error("Mechanic ID is required for knowledge base search");
        }

        console.log("Executing knowledge base search");
        const { query, limit = 3 } = params;
        // Make API call to external knowledge base service
        try {
          const response = await axios.post(
            "https://knowledge-base-tool.onrender.com/api/v1/kb/search",
            {
              query: query,
              limit: limit,
              includeMetadata: false,
              metadata: {
                organizationId: mechanicId,
              },
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000, // 60 second timeout
            }
          );

          console.log("✅ Knowledge base API response:", response.data);

          // Return direct API response
          return {
            success: true,
            message: "Knowledge base query processed successfully",
            response: response.data,
          };
        } catch (apiError) {
          console.error(
            "❌ Knowledge base API error:",
            apiError.response?.data || apiError.message
          );

          return {
            success: false,
            message: "Failed to get response from knowledge base",
            error: apiError.response?.data?.message || apiError.message,
          };
        }
      },
    });

    // Register Knowledge Base Chat tool for VAPI
    this.registerTool({
      name: "knowledge_base_chat",
      description:
        "Search the organization's knowledge base for relevant information",
      functionDeclaration: {
        name: "knowledge_base_chat",
        description:
          "Search the organization's knowledge base for information related to the query",
        parameters: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description:
                "The message or query to search for in the knowledge base",
            },
            organizationId: {
              type: Type.STRING,
              description: "The organization ID to search within",
            },
          },
          required: ["message", "organizationId"],
        },
      },
      execute: async (params, mechanicId) => {
        const { message, organizationId } = params;

        if (!message) {
          throw new Error("Message is required for knowledge base chat");
        }

        if (!organizationId) {
          throw new Error(
            "Organization ID is required for knowledge base chat"
          );
        }

        console.log(
          "Executing knowledge base chat for organization:",
          organizationId
        );

        // This tool will be called by VAPI, so we return a placeholder
        // The actual execution happens in the VAPI webhook endpoint
        return {
          message: "Knowledge base query received",
          organizationId: organizationId,
          query: message,
          status: "pending_vapi_execution",
        };
      },
    });

    // Register Appointment Booking Tool
    this.registerTool({
      name: "Appointment_BookingTool",
      description: "Book an appointment with the mechanic",
      functionDeclaration: AppointmentBookingTool.getFunctionDeclaration(),
      execute: AppointmentBookingTool.execute,
    });

    // Add additional tools as needed
  }
}

const toolRegistry = new ToolRegistry();

module.exports = toolRegistry;
