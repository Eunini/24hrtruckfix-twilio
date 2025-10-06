const { ChatThread, ChatMessage } = require("../models/chat");
const { FunctionCallingConfigMode, GoogleGenAI } = require("@google/genai");
const { Mechanic, Organization, AICallActivity } = require("../models");
const env = require("../config");
const toolRegistry = require("../tools");
const { generateAssistantPrompt } = require("../utils/prompts");
const { customPromptService } = require("./customPrompt.service");
const { clientCustomPromptService } = require("./clientCustomPrompt.service");
const {
  addChatSessionTimeoutJob,
  updateChatSessionTimeoutJob,
} = require("./queue/queueManager");

// Initialize Google AI with error handling
let googleAI = null;
try {
  if (env.google && env.google.gemini) {
    googleAI = new GoogleGenAI({ apiKey: env.google.gemini });
    console.log("✅ Google AI initialized for chat service");
  } else {
    console.warn(
      "⚠️ Google Gemini API key not found in chat service configuration"
    );
  }
} catch (error) {
  console.error(
    "❌ Failed to initialize Google AI in chat service:",
    error.message
  );
}

function replaceTemplateVariables(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables.hasOwnProperty(key) ? variables[key] : match;
  });
}

class ChatService {
  constructor() {
    // Tools are now managed in the toolRegistry
    // The toolRegistry is initialized separately
  }

  /**
   * Create a new chat thread
   */
  async createChatThread(params) {
    const {
      mechanicId,
      organizationId,
      title,
      isOrg = false,
      variables,
    } = params;

    // Validate that either mechanicId or organizationId is provided
    if (!mechanicId && !organizationId) {
      throw new Error("Either mechanicId or organizationId is required");
    }

    if (isOrg && !organizationId) {
      throw new Error("Organization ID is required for organization chats");
    }

    if (!isOrg && !mechanicId) {
      throw new Error("Mechanic ID is required for mechanic chats");
    }

    let entity;
    let chatType;

    if (isOrg) {
      // Verify organization exists
      entity = await Organization.findById(organizationId);
      chatType = "organization";

      if (!entity) {
        throw new Error("Organization not found");
      }
    } else {
      // Verify mechanic exists
      entity = await Mechanic.findById(mechanicId);
      chatType = "mechanic";

      if (!entity) {
        throw new Error("Mechanic not found");
      }
    }

    // Create the chat thread
    const chatThreadData = {
      title: title || "New Chat",
      lastMessageAt: new Date(),
      chatType,
      variables,
    };

    if (isOrg) {
      chatThreadData.organizationId = organizationId;
    } else {
      chatThreadData.mechanicId = mechanicId;
    }

    const chatThread = new ChatThread(chatThreadData);
    await chatThread.save();

    // create ai call activity
    const aiCallActivity = new AICallActivity({
      call_id: chatThread._id,
      call_type: "chat",
      mechanic_id: isOrg ? null : mechanicId,
      organization_id: isOrg ? organizationId : null,
      recorded_time: new Date(),
      number: "web-chat",
    });

    aiCallActivity.save().catch((error) => {
      console.error("Error creating ai call activity:", error);
    });

    // Add chat session timeout job (10 minutes of inactivity)
    try {
      await addChatSessionTimeoutJob(
        chatThread._id.toString(),
        isOrg ? null : mechanicId,
        isOrg ? organizationId : null
      );
      console.log(
        `✅ Chat session timeout job scheduled for thread ${chatThread._id}`
      );
    } catch (timeoutError) {
      console.error("Error scheduling chat session timeout:", timeoutError);
      // Don't fail the chat creation if timeout scheduling fails
    }

    return chatThread;
  }

  /**
   * Get chat threads for a user
   */
  async getChatThreads(userId, mechanicId, organizationId, isOrg = false) {
    const query = { userId };

    if (isOrg) {
      if (organizationId) {
        query.organizationId = organizationId;
      }
      query.chatType = "organization";
    } else {
      if (mechanicId) {
        query.mechanicId = mechanicId;
      }
      query.chatType = "mechanic";
    }

    return await ChatThread.find(query).sort({ lastMessageAt: -1 }).limit(20);
  }

  /**
   * Get a chat thread by ID
   */
  async getChatThread(threadId, user) {
    const thread = await ChatThread.findById(threadId);

    if (!thread) {
      throw new Error("Chat thread not found");
    }

    return thread;
  }

  /**
   * Get messages for a chat thread
   */
  async getChatMessages(threadId, user) {
    // First verify the user has access to this thread
    await this.getChatThread(threadId, user);

    return await ChatMessage.find({ threadId }).sort({ createdAt: 1 });
  }

  /**
   * Delete a chat thread
   */
  async deleteChatThread(threadId, user) {
    await this.getChatThread(threadId, user);

    // Delete all messages in the thread
    await ChatMessage.deleteMany({ threadId });

    // Delete the thread
    await ChatThread.deleteOne({ _id: threadId });

    return { success: true };
  }

  /**
   * Add a message to a chat thread
   */
  async addMessage(threadId, role, content, metadata = {}) {
    // CRITICAL FIX: Ensure content is always a string
    const safeContent =
      typeof content === "string"
        ? content
        : content === null || content === undefined
        ? ""
        : JSON.stringify(content);

    const message = new ChatMessage({
      threadId,
      role,
      content: safeContent,
      metadata,
    });

    await message.save();

    // Update the lastMessageAt field in the thread
    await ChatThread.updateOne(
      { _id: threadId },
      { lastMessageAt: new Date() }
    );

    // Reschedule the chat session timeout job when new messages are added
    try {
      await updateChatSessionTimeoutJob(threadId);
      console.log(`🔄 Chat session timeout rescheduled for thread ${threadId}`);
    } catch (timeoutError) {
      console.error("Error rescheduling chat session timeout:", timeoutError);
      // Don't fail the message saving if timeout rescheduling fails
    }

    return message;
  }

  /**
   * Process conversation history to ensure valid API format
   * This method ensures that all function calls have corresponding responses
   */
  processConversationHistory(messages) {
    // Group messages by pairs of function calls and responses
    const processedMessages = [];
    let currentFunctionCall = null;
    let skipNextMessage = false;

    // First, ensure messages are in correct order
    const orderedMessages = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < orderedMessages.length; i++) {
      const message = orderedMessages[i];

      if (skipNextMessage) {
        skipNextMessage = false;
        continue;
      }

      // If this is a function message, look for a corresponding response
      if (message.role === "function") {
        // Skip function messages as they'll be handled with their matching assistant message
        continue;
      }

      // Check if this assistant message has a function call
      const hasFunctionCall =
        message.role === "assistant" &&
        message.metadata &&
        message.metadata.functionCall;

      if (hasFunctionCall) {
        // Look for a corresponding function response in the next message
        const nextMessage =
          i + 1 < orderedMessages.length ? orderedMessages[i + 1] : null;
        const hasMatchingResponse =
          nextMessage &&
          nextMessage.role === "function" &&
          nextMessage.metadata &&
          nextMessage.metadata.functionName ===
            message.metadata.functionCall.name;

        if (hasMatchingResponse) {
          // Add the assistant message with function call
          processedMessages.push({
            ...message,
            // Mark that this has a valid function call
            _hasValidFunctionCall: true,
          });

          // Add the function response, skip it in next iteration
          processedMessages.push(nextMessage);
          skipNextMessage = true;
        } else {
          // If no matching response, add as regular message without function call metadata
          processedMessages.push({
            ...message,
            metadata: {
              ...message.metadata,
              functionCall: undefined,
            },
          });
        }
      } else {
        // Regular message, add as is
        processedMessages.push(message);
      }
    }

    return processedMessages;
  }

  /**
   * Convert stored messages to Gemini API format
   */
  formatMessagesForAPI(messages) {
    // First process the conversation history to ensure valid structure
    const processedMessages = this.processConversationHistory(messages);

    return processedMessages.map((msg) => {
      if (msg.role === "function") {
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.metadata?.functionName || "unknown_function",
                response: { content: msg.content },
              },
            },
          ],
        };
      } else if (msg.role === "assistant") {
        // Check if this message has a valid function call
        if (msg._hasValidFunctionCall && msg.metadata?.functionCall) {
          return {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: msg.metadata.functionCall.name,
                  args: msg.metadata.functionCall.args || {},
                },
              },
            ],
          };
        }

        // Regular assistant message
        return {
          role: "model",
          parts: [{ text: msg.content }],
        };
      } else {
        return {
          role: msg.role,
          parts: [{ text: msg.content }],
        };
      }
    });
  }

  /**
   * Create a fresh conversation without function call history
   * Used when the conversation history has issues with function calls
   */
  async createFreshConversation(threadId) {
    // Get all messages in order
    const allMessages = await ChatMessage.find({ threadId })
      .sort({ createdAt: 1 })
      .lean();

    // Filter to just user and assistant messages, remove function messages
    const simpleMessages = allMessages.filter(
      (msg) =>
        msg.role === "user" ||
        (msg.role === "assistant" &&
          (!msg.metadata || !msg.metadata.functionCall))
    );

    // Format these for the API
    return simpleMessages.map((msg) => {
      if (msg.role === "assistant") {
        return {
          role: "model",
          parts: [{ text: msg.content }],
        };
      } else {
        return {
          role: msg.role,
          parts: [{ text: msg.content }],
        };
      }
    });
  }

  /**
   * Generate a response using the Gemini model with tools
   */
  async generateResponse(
    threadId,
    mechanicId,
    organizationId,
    userMessage,
    streaming = false,
    variables = {}
  ) {
    try {
      // Get previous messages for context (limit to last 20)
      const messages = await ChatMessage.find({ threadId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      // Reverse to get chronological order
      messages.reverse();

      // Format messages for Gemini API
      let formattedContents;
      let useFreshConversation = false;

      try {
        formattedContents = this.formatMessagesForAPI(messages);
      } catch (formatError) {
        console.error(
          "Error formatting messages for API, using fresh conversation:",
          formatError
        );
        formattedContents = await this.createFreshConversation(threadId);
        useFreshConversation = true;
      }

      // Add the new user message
      formattedContents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });

      // Generate the system prompt with dynamic values
      let businessName = "";
      let agentName = "";
      let mechanic;

      if (organizationId) {
        const organization = await Organization.findById(organizationId);
        businessName = organization.companyName || "Our Organization";
        agentName = organization.contactPerson || "Our Representative";
      } else {
        // Get mechanic information for context
        mechanic = await Mechanic.findById(mechanicId);
        businessName = mechanic.companyName || "Our Organization";
        agentName = mechanic.contactPerson || "Our Representative";
      }

      const currentTime = new Date().toISOString();
      let customPrompt;

      // check for custom prompt
      let systemInstruction;
      if (organizationId) {
        customPrompt =
          await clientCustomPromptService.findByOrganizationIdAndType(
            organizationId,
            "web-chat"
          );

        if (customPrompt && customPrompt.isActive && customPrompt.prompt) {
          systemInstruction = customPrompt.prompt;
        } else {
          systemInstruction = `You are an AI assistant for ${businessName} and your name is ${agentName}. You are a helpful assistant that can answer questions and help with tasks.`;
        }
      } else {
        customPrompt = await customPromptService.findByMechanicId(mechanicId);
        if (customPrompt && customPrompt.isActive && customPrompt.chatPrompt) {
          // use custom chat prompt
          systemInstruction = customPrompt.chatPrompt;
        }

        // if no custom prompt, use default prompt generator
        if (!systemInstruction) {
          // create system prompt using the prompt generator
          systemInstruction = generateAssistantPrompt(
            mechanic.firstName + " " + mechanic.lastName,
            mechanic.specialty,
            mechanic.serviceCapabilities?.join(", ") + mechanic.OtherServices
          );
        }
      }

      // registerAllTools();
      toolRegistry.registerDefaultTools();

      systemInstruction = replaceTemplateVariables(
        systemInstruction,
        variables
      );

      if (variables.userType) {
        systemInstruction.replaceAll(
          "{{flowToUse}}",
          variables[variables.userType]
        );
      }

      // Setup the configuration with tools from the registry
      const config = {
        tools: [
          {
            functionDeclarations: toolRegistry.getToolFunctionDeclarations(),
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
        temperature: 0.7,
        maxOutputTokens: 4096,
        systemInstruction:
          systemInstruction + `The current date is ${new Date()}`,
      };

      if (streaming) {
        if (!googleAI) {
          throw new Error(
            "Google AI not initialized - cannot create streaming chat"
          );
        }
        // Create a streaming chat session
        const chat = googleAI.chats.create({
          model: "gemini-2.0-flash",
          history: formattedContents.slice(0, -1), // All but the latest user message
          config,
        });

        // Return streaming response
        return await chat.sendMessageStream({
          message: userMessage,
        });
      } else {
        let response;
        try {
          if (!googleAI) {
            throw new Error(
              "Google AI not initialized - cannot generate content"
            );
          }
          // For non-streaming, use generateContent directly
          response = await googleAI.models.generateContent({
            model: "gemini-2.0-flash",
            contents: formattedContents,
            config: config,
          });
        } catch (error) {
          console.error("Error in initial generateContent call:", error);

          // If we already tried with fresh conversation and still have issues
          if (useFreshConversation) {
            // Save a fallback response when API fails even with fresh conversation
            const fallbackResponse =
              "I'm having trouble processing your request right now. Let me try to help in another way.";
            await this.addMessage(threadId, "assistant", fallbackResponse);
            return fallbackResponse;
          }

          // Try again with a fresh conversation (no function call history)
          console.log("Retrying with fresh conversation history...");
          formattedContents = await this.createFreshConversation(threadId);

          // Add the new user message
          formattedContents.push({
            role: "user",
            parts: [{ text: userMessage }],
          });

          try {
            if (!googleAI) {
              throw new Error(
                "Google AI not initialized - cannot retry with fresh conversation"
              );
            }
            response = await googleAI.models.generateContent({
              model: "gemini-2.0-flash",
              contents: formattedContents,
              config: config,
            });
          } catch (retryError) {
            console.error("Error even with fresh conversation:", retryError);
            const fallbackResponse =
              "I'm having trouble with my knowledge tools right now. Let me help based on what I know about your organization.";
            await this.addMessage(threadId, "assistant", fallbackResponse);
            return fallbackResponse;
          }
        }

        // Process function calls if any
        if (response.functionCalls && response.functionCalls.length > 0) {
          console.log(response.functionCalls);
          try {
            // Process the first function call only to avoid complexity
            const functionCall = response.functionCalls[0];
            const functionName = functionCall.name;
            const functionArgs = functionCall.args;

            try {
              console.log({ ...functionArgs, threadId: threadId });
              // Execute the tool using our registry
              const result = await toolRegistry.executeTool(
                functionName,
                { ...functionArgs, threadId: threadId },
                mechanicId
              );

              // Save the assistant's message with function call info
              await this.addMessage(
                threadId,
                "assistant",
                response.text || "I need to check something for you.",
                { functionCall: { name: functionName, args: functionArgs } }
              );

              // Stringify result properly, ensuring it's never undefined
              const resultContent = JSON.stringify(result || {});

              // Log the function call as a message
              await this.addMessage(threadId, "function", resultContent, {
                functionName,
                args: functionArgs,
              });

              // Create a new API request for the function response
              // Get the most recent messages to ensure they include our function call and response
              const updatedMessages = await ChatMessage.find({ threadId })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

              // Reverse to get chronological order
              updatedMessages.reverse();

              // Format messages again with the function call and response included
              const updatedContents =
                this.formatMessagesForAPI(updatedMessages);

              try {
                if (!googleAI) {
                  throw new Error(
                    "Google AI not initialized - cannot get final response"
                  );
                }
                // Get final response from the model with function response included
                const finalResponse = await googleAI.models.generateContent({
                  model: "gemini-2.0-flash",
                  contents: updatedContents,
                  config: {
                    ...config,
                    // Don't allow further function calls in this response
                    toolConfig: {
                      functionCallingConfig: {
                        mode: FunctionCallingConfigMode.NONE,
                      },
                    },
                  },
                });

                // Save and return the final response
                const finalResponseText =
                  finalResponse.text ||
                  "Based on what I found, I can help with your request.";
                await this.addMessage(threadId, "assistant", finalResponseText);
                return finalResponseText;
              } catch (finalResponseError) {
                console.error(
                  "Error getting final response after function call:",
                  finalResponseError
                );
                // Use simpler fallback that incorporates function results
                const fallbackFinalResponse = `I found some information that might help. ${
                  typeof result === "object" && result.length > 0
                    ? `I found ${result.length} relevant details.`
                    : "However, I'm having trouble processing it right now."
                }`;
                await this.addMessage(
                  threadId,
                  "assistant",
                  fallbackFinalResponse
                );
                return fallbackFinalResponse;
              }
            } catch (functionError) {
              console.error(
                `Error executing function ${functionName}:`,
                functionError
              );
              // Handle function execution error
              const errorResponse = `I tried to search for information about "${
                functionArgs?.query || "your question"
              }" but encountered an issue. Let me help based on what I know.`;
              await this.addMessage(threadId, "assistant", errorResponse);
              return errorResponse;
            }
          } catch (error) {
            console.error("Error in function call processing:", error);
            const errorResponse =
              "I encountered an error while processing your request. Let me try to answer directly.";
            await this.addMessage(threadId, "assistant", errorResponse);
            return errorResponse;
          }
        }

        // If no function calls, save the original response
        const responseText =
          response.text || "I understand your request. Let me help with that.";
        await this.addMessage(threadId, "assistant", responseText);
        return responseText;
      }
    } catch (error) {
      console.error("Error generating response:", error);
      // Add a fallback message in case of error
      const errorMessage =
        "I apologize, but I'm having trouble processing your request right now. Can you please tell me again how I can help?";
      try {
        await this.addMessage(threadId, "assistant", errorMessage);
      } catch (saveError) {
        console.error("Error saving fallback message:", saveError);
      }
      throw new Error("Failed to generate response");
    }
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(params) {
    const { threadId, content, user } = params;

    try {
      // Verify thread and permissions
      const thread = await this.getChatThread(threadId, user);

      // Add the user message
      await this.addMessage(threadId, "user", content);

      // Generate and save response (non-streaming)
      const response = await this.generateResponse(
        threadId,
        thread.mechanicId,
        thread.organizationId,
        content,
        false,
        thread?.variables
      );

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async updateChatWorkflowId(id, workflowId) {
    try {
      await ChatThread.updateOne(
        { _id: id },
        {
          workflowId,
        }
      );
    } catch (error) {
      console.error("Error updating chat workflow ID:", error);
      throw new Error("Failed to update chat workflow ID");
    }
  }

  /**
   * Send a message and get a streaming response
   */
  async sendMessageStream(params) {
    const { threadId, content, user } = params;

    try {
      // Verify thread and permissions
      const thread = await this.getChatThread(threadId, user);
      const { mechanicId, organizationId } = thread;
      // Add the user message
      await this.addMessage(threadId, "user", content);

      // Get previous messages for context
      const messages = await ChatMessage.find({ threadId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      // Reverse to get chronological order
      messages.reverse();

      // Format messages for API
      let formattedContents;
      try {
        formattedContents = this.formatMessagesForAPI(messages);
      } catch (formatError) {
        console.error("Error formatting messages for API:", formatError);
        formattedContents = await this.createFreshConversation(threadId);
      }

      // Add the new user message
      formattedContents.push({
        role: "user",
        parts: [{ text: content }],
      });

      // Generate the system prompt with dynamic values
      let businessName = "";
      let agentName = "";
      let mechanic;

      if (organizationId) {
        const organization = await Organization.findById(organizationId);
        businessName = organization.companyName || "Our Organization";
        agentName = organization.contactPerson || "Our Representative";
      } else {
        // Get mechanic information for context
        mechanic = await Mechanic.findById(mechanicId);
        businessName = mechanic.companyName || "Our Organization";
        agentName = mechanic.contactPerson || "Our Representative";
      }

      const currentTime = new Date().toISOString();
      let customPrompt;

      // check for custom prompt
      let systemInstruction;
      if (organizationId) {
        customPrompt =
          await clientCustomPromptService.findByOrganizationIdAndType(
            organizationId,
            "web-chat"
          );

        if (customPrompt && customPrompt.isActive && customPrompt.prompt) {
          systemInstruction = customPrompt.prompt;
        } else {
          systemInstruction = `You are an AI assistant for ${businessName} and your name is ${agentName}. You are a helpful assistant that can answer questions and help with tasks.`;
        }
      } else {
        customPrompt = await customPromptService.findByMechanicId(mechanicId);
        if (customPrompt && customPrompt.isActive && customPrompt.chatPrompt) {
          // use custom chat prompt
          systemInstruction = customPrompt.chatPrompt;
        }

        // if no custom prompt, use default prompt generator
        if (!systemInstruction) {
          // create system prompt using the prompt generator
          systemInstruction = generateAssistantPrompt(
            mechanic.firstName + " " + mechanic.lastName,
            mechanic.specialty,
            mechanic.serviceCapabilities?.join(", ") + mechanic.OtherServices
          );
        }
      }

      // Make sure tools are registered
      toolRegistry.registerDefaultTools();

      if (thread?.variables) {
        thread.variables.flowToUse =
          thread?.variables[thread?.variables.userType] || "";
      }

      systemInstruction = replaceTemplateVariables(
        systemInstruction,
        thread?.variables
      );

      // Setup the configuration with tools
      const config = {
        tools: [
          {
            functionDeclarations: toolRegistry.getToolFunctionDeclarations(),
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
        temperature: 0.7,
        maxOutputTokens: 4096,
        systemInstruction:
          systemInstruction + `The current date is ${new Date()}`,
      };

      if (!googleAI) {
        throw new Error(
          "Google AI not initialized - cannot create streaming chat"
        );
      }

      // Create a streaming chat session
      const chat = googleAI.chats.create({
        model: "gemini-2.0-flash",
        history: formattedContents.slice(0, -1), // All but the latest user message
        config,
      });

      // Get the streaming response
      const streamingResponse = await chat.sendMessageStream({
        message: content,
      });

      // Create a wrapper around the stream
      const enhancedStream = {
        stream: streamingResponse,

        // Method to detect and process function calls
        async detectAndProcessFunctionCall(chunk) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            this.hasFunctionCall = true;
            this.functionCall = chunk.functionCalls[0];
            this.functionCallName = chunk.functionCalls[0].name;
            this.functionCallArgs = chunk.functionCalls[0].args;
            return true;
          }
          return false;
        },

        // Method to execute the function call and get a new response
        async processFunctionCallAndGetResponse(initialContent) {
          try {
            if (!this.hasFunctionCall) {
              return null;
            }

            console.log(
              `Executing function: ${this.functionCallName}`,
              this.functionCallArgs
            );

            // Execute the function/tool
            const result = await toolRegistry.executeTool(
              this.functionCallName,
              {
                ...this.functionCallArgs,
                threadId: threadId,
                isOrg: Boolean(thread.organizationId),
              },
              thread.mechanicId || thread.organizationId
            );

            console.log(`Function result:`, result);

            // Save the assistant's message with function call info
            await this.addMessage(
              threadId,
              "assistant",
              initialContent || `I need to check something for you.`,
              {
                functionCall: {
                  name: this.functionCallName,
                  args: this.functionCallArgs,
                },
              }
            );

            // Stringify the result
            const resultContent = JSON.stringify(result || {});

            // Save the function result as a message
            await this.addMessage(threadId, "function", resultContent, {
              functionName: this.functionCallName,
              args: this.functionCallArgs,
            });

            // Get the updated conversation history including the function call and result
            const updatedMessages = await ChatMessage.find({ threadId })
              .sort({ createdAt: -1 })
              .limit(20)
              .lean();

            // Format for the API
            const updatedContents = this.formatMessagesForAPI(
              updatedMessages.reverse()
            );

            if (!googleAI) {
              throw new Error(
                "Google AI not initialized - cannot get final response"
              );
            }

            // Get the final response from Gemini with the function result included
            const finalResponse = await googleAI.models.generateContent({
              model: "gemini-2.0-flash",
              contents: updatedContents,
              config: {
                ...config,
                toolConfig: {
                  functionCallingConfig: {
                    mode: FunctionCallingConfigMode.NONE, // Prevent further function calls
                  },
                },
              },
            });

            // Save this final response
            await this.addMessage(
              threadId,
              "assistant",
              finalResponse.text ||
                "Based on what I found, I can help with your request."
            );

            // Return the final response
            return finalResponse.text;
          } catch (error) {
            console.error("Error processing function call:", error);
            return "I tried to look up information, but encountered an issue. Let me help based on what I know.";
          }
        },
      };

      // Initialize function call properties
      enhancedStream.hasFunctionCall = false;
      enhancedStream.functionCall = null;
      enhancedStream.functionCallName = null;
      enhancedStream.functionCallArgs = null;
      enhancedStream.initialContent = "";

      // Bind methods from this class
      enhancedStream.addMessage = this.addMessage.bind(this);
      enhancedStream.formatMessagesForAPI =
        this.formatMessagesForAPI.bind(this);

      return enhancedStream;
    } catch (error) {
      console.error("Error in sendMessageStream:", error);
      throw error;
    }
  }
}

const chatService = new ChatService();

module.exports = { chatService };
