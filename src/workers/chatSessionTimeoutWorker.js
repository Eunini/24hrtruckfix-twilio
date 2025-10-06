const { chatSessionTimeoutQueue } = require("../services/queue/queueManager");
const { ChatThread, ChatMessage } = require("../models/chat");
const {
  analyzeTranscriptAndCreateHubSpotRecords,
} = require("../services/transcript-analyzer.service");
const env = require("../config");

// Initialize Google AI for transcript analysis
let geminiModel = null;

// Try to initialize Gemini model with proper error handling
try {
  if (env.google && env.google.gemini) {
    // Use the @google/generative-ai package (more stable)
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(env.google.gemini);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    console.log("✅ Gemini AI initialized with @google/generative-ai package");
  } else {
    console.warn("⚠️ Google Gemini API key not found in configuration");
  }
} catch (error) {
  console.error("❌ Failed to initialize Gemini AI:", error.message);
  console.warn(
    "⚠️ Transcript analysis will be skipped if Gemini AI is not available"
  );
}

// Process chat session timeout jobs
chatSessionTimeoutQueue.process("chat-session-timeout", async (job) => {
  const { threadId, mechanicId, organizationId } = job.data;

  try {
    console.log(`🔄 Processing chat session timeout for thread ${threadId}`);

    // Update progress
    await job.progress(10);

    // Get the chat thread to verify it still exists
    const chatThread = await ChatThread.findById(threadId);
    if (!chatThread) {
      console.log(
        `⚠️ Chat thread ${threadId} not found, skipping timeout processing`
      );
      return {
        success: true,
        message: "Chat thread not found, already cleaned up",
        threadId,
        processedAt: new Date(),
      };
    }

    // Update progress
    await job.progress(20);

    // Check if there are any messages in the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentMessages = await ChatMessage.find({
      threadId,
      createdAt: { $gte: tenMinutesAgo },
    })
      .sort({ createdAt: -1 })
      .limit(1);

    // Update progress
    await job.progress(40);

    if (recentMessages.length > 0) {
      // There are recent messages, reschedule the timeout job
      console.log(
        `🔄 Recent activity found in thread ${threadId}, rescheduling timeout`
      );

      // Import the queue manager functions to reschedule
      const {
        addChatSessionTimeoutJob,
      } = require("../services/queue/queueManager");

      // Schedule a new timeout job
      await addChatSessionTimeoutJob(threadId, mechanicId, organizationId);

      return {
        success: true,
        message: "Recent activity detected, timeout rescheduled",
        threadId,
        rescheduled: true,
        processedAt: new Date(),
      };
    }

    // Update progress
    await job.progress(60);

    // No recent activity, proceed with session termination
    console.log(
      `⏰ No recent activity in thread ${threadId}, terminating session`
    );

    // Get all messages from the chat thread to create transcript
    const allMessages = await ChatMessage.find({ threadId })
      .sort({ createdAt: 1 })
      .lean();

    // Update progress
    await job.progress(70);

    if (allMessages.length === 0) {
      console.log(
        `⚠️ No messages found in thread ${threadId}, skipping transcript analysis`
      );
      return {
        success: true,
        message: "No messages to analyze",
        threadId,
        processedAt: new Date(),
      };
    }

    // Format messages into a readable transcript
    const transcript = allMessages
      .map((msg) => {
        const timestamp = new Date(msg.createdAt).toISOString();
        const role =
          msg.role === "user"
            ? "Customer"
            : msg.role === "assistant"
            ? "Assistant"
            : msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

        return `[${timestamp}] ${role}: ${msg.content}`;
      })
      .join("\n");

    // Update progress
    await job.progress(80);

    console.log(
      `📝 Analyzing transcript for thread ${threadId} (${allMessages.length} messages)`
    );

    // Analyze transcript and create HubSpot records
    let analysisResult;
    try {
      if (!geminiModel) {
        console.warn(
          `⚠️ Gemini AI not available, skipping transcript analysis for thread ${threadId}`
        );
        analysisResult = {
          success: false,
          error: "Gemini AI not available",
          contact: null,
          task: null,
        };
      } else {
        analysisResult = await analyzeTranscriptAndCreateHubSpotRecords(
          transcript,
          geminiModel,
          "",
          null // No structured data provided, let AI extract it
        );
      }

      console.log(`✅ Transcript analysis completed for thread ${threadId}:`, {
        success: analysisResult.success,
        contactCreated: analysisResult.contact?.created,
        contactExisted: analysisResult.contact?.existed,
        taskCreated: analysisResult.task?.created,
        error: analysisResult.error,
      });
    } catch (analysisError) {
      console.error(
        `❌ Error analyzing transcript for thread ${threadId}:`,
        analysisError
      );
      analysisResult = {
        success: false,
        error: analysisError.message,
        contact: null,
        task: null,
      };
    }

    // Update progress
    await job.progress(90);

    // Optionally, you could mark the chat thread as completed or add metadata
    try {
      await ChatThread.updateOne(
        { _id: threadId },
        {
          $set: {
            sessionEnded: true,
            sessionEndedAt: new Date(),
            transcriptAnalyzed: analysisResult.success,
            hubspotContactId: analysisResult.contact?.id || null,
            hubspotTaskId: analysisResult.task?.id || null,
          },
        }
      );
    } catch (updateError) {
      console.error(`⚠️ Error updating chat thread ${threadId}:`, updateError);
    }

    // Update progress
    await job.progress(100);

    console.log(
      `✅ Chat session timeout processing completed for thread ${threadId}`
    );

    return {
      success: true,
      message: "Chat session terminated and transcript analyzed",
      threadId,
      messageCount: allMessages.length,
      transcriptAnalysis: {
        success: analysisResult.success,
        contact: analysisResult.contact
          ? {
              id: analysisResult.contact.id,
              email: analysisResult.extractedData?.customer?.email,
              created: analysisResult.contact.created,
              existed: analysisResult.contact.existed,
            }
          : null,
        task: analysisResult.task
          ? {
              id: analysisResult.task.id,
              subject: analysisResult.extractedData?.task?.subject,
              created: analysisResult.task.created,
            }
          : null,
        error: analysisResult.error,
      },
      processedAt: new Date(),
    };
  } catch (error) {
    console.error(
      `❌ Error processing chat session timeout for thread ${threadId}:`,
      error
    );
    throw new Error(`Chat session timeout processing failed: ${error.message}`);
  }
});

// Enhanced error handling for chat session timeout queue
const setupErrorHandling = () => {
  chatSessionTimeoutQueue.on("completed", (job, result) => {
    console.log(`✅ Chat session timeout job ${job.id} completed successfully`);
    if (result.rescheduled) {
      console.log(
        `🔄 Session timeout rescheduled for thread ${result.threadId}`
      );
    } else if (result.transcriptAnalysis) {
      console.log(`📊 Transcript analyzed for thread ${result.threadId}:`, {
        messageCount: result.messageCount,
        contactCreated: result.transcriptAnalysis.contact?.created,
        taskCreated: result.transcriptAnalysis.task?.created,
      });
    }
  });

  chatSessionTimeoutQueue.on("failed", (job, err) => {
    console.error(`❌ Chat session timeout job ${job.id} failed:`, err.message);
    const { threadId } = job.data;
    console.error(`❌ Failed to process timeout for thread ${threadId}`);
  });

  chatSessionTimeoutQueue.on("stalled", (job) => {
    console.warn(`⚠️ Chat session timeout job ${job.id} stalled`);
    const { threadId } = job.data;
    console.warn(`⚠️ Timeout processing stalled for thread ${threadId}`);
  });

  chatSessionTimeoutQueue.on("progress", (job, progress) => {
    if (progress % 20 === 0) {
      // Log every 20% progress
      console.log(
        `📊 Chat session timeout job ${job.id} progress: ${progress}%`
      );
    }
  });

  chatSessionTimeoutQueue.on("removed", (job) => {
    console.log(`🗑️ Chat session timeout job ${job.id} removed`);
  });
};

// Setup error handling
setupErrorHandling();

console.log("🚀 Chat session timeout worker started and ready to process jobs");
console.log("⏰ Configuration:");
console.log("   📅 Session timeout: 10 minutes of inactivity");
console.log(
  "   🔄 Auto-reschedule: If activity detected within timeout window"
);
console.log("   📝 Transcript analysis: Automatic on session termination");
console.log("   🏢 HubSpot integration: Contact and task creation");

module.exports = {
  chatSessionTimeoutQueue,
};
