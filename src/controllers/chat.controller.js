const { Request, Response } = require("express");
const mongoose = require("mongoose");
const { ChatMessage } = require("../models/chat");
const { chatService } = require("../services/chat.service");
// const AiActivity = require("../models/aiActivity");
// const { workflowClient } = require("../config/upstash");
// const { env } = require("../config");

const createChatThread = async (req, res) => {
  try {
    const {
      mechanicId,
      organizationId,
      title,
      initialMessage,
      isOrg = false,
      variables = {},
    } = req.body;

    // Validate required parameters based on chat type
    if (isOrg) {
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required for organization chats",
        });
      }

      // Validate organizationId is a valid ObjectId
      if (!mongoose.isValidObjectId(organizationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid organization ID format",
        });
      }
    } else {
      if (!mechanicId) {
        return res.status(400).json({
          success: false,
          message: "Mechanic ID is required for mechanic chats",
        });
      }

      // Validate mechanicId is a valid ObjectId
      if (!mongoose.isValidObjectId(mechanicId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mechanic ID format",
        });
      }
    }

    if (!initialMessage || !title) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
      });
    }

    const result = await chatService.createChatThread({
      mechanicId: isOrg ? undefined : mechanicId,
      organizationId: isOrg ? organizationId : undefined,
      title,
      isOrg,
      variables,
    });

    if (!result || !result?._id) {
      const entityType = isOrg ? "Organization" : "Mechanic";
      res.status(404).json({
        success: false,
        message: `${entityType} not found.`,
      });
      return;
    }

    const { response } = await chatService.sendMessage({
      threadId: result?._id,
      content: initialMessage,
      user: req.user,
    });

    // const ai_activity = new AiActivity({
    //   callId: result?._id,
    //   mechanicId: isOrg ? undefined : mechanicId,
    //   organizationId: isOrg ? organizationId : undefined,
    //   number: "N/A",
    //   callType: "web_chat",
    // });

    // await ai_activity.save();

    // const workflowData = await workflowClient.trigger({
    //   url: `${env.backendOrigin}/api/v0/workflows/chat/end-session`,
    //   body: {
    //     id: result?._id,
    //   },
    // });

    // if (workflowData.workflowRunId) {
    //   await chatService.updateChatWorkflowId(
    //     result?.id,
    //     workflowData.workflowRunId
    //   );
    // }

    const entityType = isOrg ? "organization" : "mechanic";
    res.status(200).json({
      success: true,
      data: { id: result?._id, firstMessage: response },
      message: `${
        entityType.charAt(0).toUpperCase() + entityType.slice(1)
      } chat thread created successfully`,
    });
  } catch (error) {
    console.error("Error creating chat thread:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to create chat thread",
      });
    }
  }
};

const getChatThreads = async (req, res) => {
  try {
    const { mechanicId, organizationId, isOrg = false } = req.query;

    let queryMechanicId, queryOrganizationId;

    if (isOrg === "true" || isOrg === true) {
      // Organization chat threads
      if (organizationId && mongoose.isValidObjectId(organizationId)) {
        queryOrganizationId = new mongoose.Types.ObjectId(organizationId);
      }
    } else {
      // Mechanic chat threads
      if (mechanicId && mongoose.isValidObjectId(mechanicId)) {
        queryMechanicId = new mongoose.Types.ObjectId(mechanicId);
      }
    }

    const threads = await chatService.getChatThreads(
      new mongoose.Types.ObjectId(req.user.id),
      queryMechanicId,
      queryOrganizationId,
      isOrg === "true" || isOrg === true
    );

    res.status(200).json({
      success: true,
      data: threads,
    });
  } catch (error) {
    console.error("Error fetching chat threads:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat threads",
      });
    }
  }
};

const getChatThread = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat thread ID format",
      });
    }

    const thread = await chatService.getChatThread(
      new mongoose.Types.ObjectId(id),
      req.user
    );

    res.status(200).json({
      success: true,
      data: thread,
    });
  } catch (error) {
    console.error("Error fetching chat thread:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat thread",
      });
    }
  }
};

const getChatMessages = async (req, res) => {
  try {
    const { threadId } = req.params;

    if (!mongoose.isValidObjectId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat thread ID format",
      });
    }

    const messages = await chatService.getChatMessages(
      new mongoose.Types.ObjectId(threadId),
      req.user
    );

    res.status(200).json({
      id: threadId,
      call_id: threadId,
      call_analysis: {},
      transcript_object: messages?.filter((item) => {
        if (item.role === "function") return;
        if (item.content === "undefined") return;
        return {
          role: item.role,
          content: item.content,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat messages",
      });
    }
  }
};

const deleteChatThread = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat thread ID format",
      });
    }

    await chatService.deleteChatThread(
      new mongoose.Types.ObjectId(id),
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Chat thread deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting chat thread:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to delete chat thread",
      });
    }
  }
};

const sendMessage = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(threadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chat thread ID format",
      });
    }

    if (!content || typeof content !== "string" || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // Handle streaming flag
    const isStreaming = req.query.stream === "true";

    if (isStreaming) {
      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // For CORS (if needed)
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");

      try {
        // Get the enhanced stream
        const enhancedStream = await chatService.sendMessageStream({
          threadId: threadId,
          content,
          user: req.user,
        });

        // Create a new message in the database to store the assistant's response
        const assistantMessage = new ChatMessage({
          threadId: threadId,
          role: "assistant",
          content: "Hello", // Start with empty content
        });

        await assistantMessage.save();

        // Send the message ID to the client
        res.write(
          `data: ${JSON.stringify({ messageId: assistantMessage._id })}\n\n`
        );

        let fullContent = "";
        let hasFunctionCall = false;

        // Process the stream
        for await (const chunk of enhancedStream.stream) {
          // Get the text content (handle both function and string cases)
          const chunkText =
            typeof chunk.text === "function" ? chunk.text() : chunk.text;

          // Add to accumulated content
          fullContent += chunkText;
          enhancedStream.initialContent = fullContent;

          // Check if this chunk has a function call
          const chunkHasFunctionCall =
            await enhancedStream.detectAndProcessFunctionCall(chunk);

          if (chunkHasFunctionCall && !hasFunctionCall) {
            hasFunctionCall = true;

            // Send client notification that we're calling a function
            res.write(
              `data: ${JSON.stringify({
                chunk: chunkText,
                hasFunctionCall: true,
                functionCall: enhancedStream.functionCall,
              })}\n\n`
            );

            // Update the message content
            await ChatMessage.updateOne(
              { _id: assistantMessage._id },
              { content: fullContent }
            );
          } else if (!hasFunctionCall) {
            // Send normal chunk
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);

            // Update the message content (not awaiting to avoid slowing down the stream)
            ChatMessage.updateOne(
              { _id: assistantMessage._id },
              { content: fullContent }
            ).catch((err) =>
              console.error("Error updating message content:", err)
            );
          }
        }

        // If there was a function call, process it and get the final response
        if (hasFunctionCall) {
          console.log("Processing function call and getting final response");

          // Inform client we're processing
          res.write(
            `data: ${JSON.stringify({
              processingTool: true,
              message: "Processing knowledge base query...",
            })}\n\n`
          );

          // Process the function call and get the final response
          const finalResponse =
            await enhancedStream.processFunctionCallAndGetResponse(fullContent);

          // Update full content with the final response
          if (finalResponse) {
            fullContent = finalResponse;
          }

          // Send the final response with tool processed flag
          res.write(
            `data: ${JSON.stringify({
              chunk: finalResponse,
              toolCallProcessed: true,
              replacePrevious: true, // Signal to replace previous content
            })}\n\n`
          );

          // Update the message
          await ChatMessage.updateOne(
            { _id: assistantMessage._id },
            { content: fullContent }
          );
        }

        // Send end event
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Streaming error:", error);
        // Send error through the stream
        res.write(
          `data: ${JSON.stringify({
            error: error.message || "Unknown error",
          })}\n\n`
        );
        res.end();
      }
    } else {
      // Non-streaming response
      const result = await chatService.sendMessage({
        threadId: threadId,
        content,
        user: req.user,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }
};

module.exports = {
  createChatThread,
  getChatThreads,
  getChatThread,
  getChatMessages,
  deleteChatThread,
  sendMessage,
};
