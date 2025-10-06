const { AICallActivity } = require("../models");
const { HTTP_STATUS_CODES } = require("../helper");
const mongoose = require("mongoose");
const Organization = require("../models/organization.model");
const vapiService = require("../services/vapi.service");
const { chatService } = require("../services/chat.service");
const { ChatMessage } = require("../models/chat");
/**
 * Get all AI call activities with pagination and filtering
 */
exports.getAICallActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortField = "recorded_time",
      sort = -1,
      call_type,
      organization_id,
    } = req.query;

    // Build query object
    const query = {};

    // Add organization filter
    if (organization_id) {
      query.organization_id = organization_id;
    } else if (req.user?.organizationId) {
      // Use user's organization if no specific organization_id provided
      query.organization_id = req.user.organizationId;
    }

    // Add call type filter
    if (call_type) {
      query.call_type = call_type;
    }

    // Add search functionality
    if (search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [{ call_id: searchRegex }, { number: searchRegex }];
    }

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortField]: parseInt(sort) },
      populate: {
        path: "organization_id",
        select: "companyName organization_type",
      },
      lean: true,
    };

    const activities = await AICallActivity.paginate(query, options);
    // console.log(`✅ Fetched ${activities.docs.length} AI activities`, {query}, {options});

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: activities,
      message: "AI call activities retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting AI call activities:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve AI call activities",
      error: error.message,
    });
  }
};

/**
 * Get all combined orgs data for AI call activities with pagination and filtering
 */
exports.getCombinedAICallActivities = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      sortField = "recorded_time",
      sort = -1,
      call_type,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const sortDir = parseInt(sort, 10) === 1 ? 1 : -1;

    //Find all orgs this agent is connected to
    const userId = req.user?.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }
    const uid = new mongoose.Types.ObjectId(userId);

    // Define all the ways an agent may be linked in your Org model
    const orgClauses = [
      { assignedAgents: uid },
      { assignedAgent: uid },
      { agentId: uid },
      { "members.user": uid },
    ];

    const orgs = await Organization.find({ $or: orgClauses })
      .select("_id")
      .lean();

    const orgIds = orgs
      .map((o) => o._id)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (!orgIds.length) {
      // empty paging envelope
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          docs: [],
          totalDocs: 0,
          limit: limitNum,
          page: pageNum,
          totalPages: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
        message: "No call activities found",
      });
    }

    // Build the query
    const query = {
      organization_id: { $in: orgIds },
    };

    if (call_type) {
      query.call_type = call_type;
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ call_id: regex }, { number: regex }];
    }

    const options = {
      page: pageNum,
      limit: limitNum,
      sort: { [sortField]: sortDir },
      populate: {
        path: "organization_id",
        select: "companyName organization_type",
      },
      lean: true,
    };

    const activities = await AICallActivity.paginate(query, options);
    // console.log({query}, options.organization_id, orgs.length, {orgClauses})

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: activities,
      message: "Combined AI call activities retrieved successfully",
    });
  } catch (err) {
    console.error("Error in getCombinedAICallActivities:", err);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve combined AI call activities",
      error: err.message,
    });
  }
};

/**
 * Get AI call activity by ID
 */
exports.getAICallActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await AICallActivity.findById(id).populate({
      path: "organization_id",
      select: "companyName organization_type",
    });

    if (!activity) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "AI call activity not found",
      });
    }

    // Check if user has access to this activity
    if (
      req.user?.organizationId &&
      activity.organization_id._id.toString() !==
        req.user.organizationId.toString()
    ) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Access denied to this activity",
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: activity,
      message: "AI call activity retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting AI call activity by ID:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve AI call activity",
      error: error.message,
    });
  }
};

/**
 * Get AI call activity by call_id
 */
exports.getAICallActivityByCallId = async (req, res) => {
  try {
    const { call_id } = req.params;

    const activity = await AICallActivity.findOne({ call_id }).populate({
      path: "organization_id",
      select: "companyName organization_type",
    });

    if (!activity) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "AI call activity not found",
      });
    }

    // Check if user has access to this activity
    if (
      req.user?.organizationId &&
      activity.organization_id._id.toString() !==
        req.user.organizationId.toString()
    ) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Access denied to this activity",
      });
    }

    console.log("Activity:", activity);

    // Fetch additional call data based on call type
    let vapiCallData = null;
    let chatData = null;

    if (activity.call_type === "chat") {
      try {
        // Get chat messages for web chat - bypass permission check for AI call activity access
        const chatMessages = await ChatMessage.find({
          threadId: activity.call_id,
        })
          .sort({ createdAt: 1 })
          .lean();

        chatData = {
          transcript: chatMessages
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n"),
          conversation: chatMessages.map((msg) => ({
            role:
              msg.role === "user"
                ? "USER"
                : msg.role === "assistant"
                ? "BOT"
                : msg.role.toUpperCase(),
            message: msg.content,
            time: new Date(msg.createdAt).getTime(),
            duration: 0, // Chat messages don't have duration, set to 0
          })),
          messageCount: chatMessages.length,
          lastMessageAt:
            chatMessages.length > 0
              ? chatMessages[chatMessages.length - 1].createdAt
              : null,
        };
        console.log(`✅ Chat data retrieved for call_id: ${call_id}`);
      } catch (chatError) {
        console.warn(
          `⚠️ Could not retrieve chat data for call_id: ${call_id}`,
          chatError.message
        );
        // Continue without chat data - don't fail the entire request
      }
    } else {
      // For voice calls, try to get VAPI data
      try {
        vapiCallData = await vapiService.getCall(call_id);
        await vapiService.buildGeminiEmail(call_id)

        console.log(`✅ VAPI call data retrieved for call_id: ${call_id}`);
      } catch (vapiError) {
        console.warn(
          `⚠️ Could not retrieve VAPI data for call_id: ${call_id}`,
          vapiError.message
        );
        // Continue without VAPI data - don't fail the entire request
      }
    }

    // Merge activity data with call data based on type
    const responseData = {
      ...activity.toObject(), // Convert mongoose document to plain object
      // Add data based on call type
      ...(activity.call_type === "chat" &&
        chatData && {
          // Chat-specific fields
          transcript: chatData.transcript,
          conversation: chatData.conversation,
          messageCount: chatData.messageCount,
          lastMessageAt: chatData.lastMessageAt,
          // Voice-specific fields not available for chat
          duration: "Not available for chat calls",
          conversationAnalysis: "Not available for chat calls",
          summary: "Not available for chat calls",
          cost: "Not available for chat calls",
          costBreakdown: "Not available for chat calls",
          vapiStatus: "Not available for chat calls",
          vapiEndedReason: "Not available for chat calls",
          vapiStartedAt: "Not available for chat calls",
          vapiEndedAt: "Not available for chat calls",
        }),
      ...(activity.call_type !== "chat" &&
        vapiCallData && {
          // Voice call fields
          duration: vapiCallData.duration,
          conversationAnalysis: vapiCallData.conversationAnalysis,
          summary: vapiCallData.summary,
          conversation: vapiCallData.conversation,
          cost: vapiCallData.cost,
          costBreakdown: vapiCallData.costBreakdown,
          vapiStatus: vapiCallData.status,
          vapiEndedReason: vapiCallData.endedReason,
          vapiStartedAt: vapiCallData.startedAt,
          vapiEndedAt: vapiCallData.endedAt,
          // Chat-specific fields not available for voice calls
          transcript: "Not available for voice calls",
          messageCount: "Not available for voice calls",
          lastMessageAt: "Not available for voice calls",
        }),
    };

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: responseData,
      message: "AI call activity retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting AI call activity by call_id:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve AI call activity",
      error: error.message,
    });
  }
};

/**
 * Create a new AI call activity
 */
exports.createAICallActivity = async (req, res) => {
  console.log(req.body)
  try {
    const { call_id, organization_id, call_type, number } = req.body;

    // Validate required fields
    if (!call_id || !organization_id || !call_type || !number) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "call_id, organization_id, call_type, and number are required",
      });
    }

    // Check if activity with this call_id already exists
    const existingActivity = await AICallActivity.findOne({ call_id });
    if (existingActivity) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: "Activity with this call_id already exists",
      });
    }

    const newActivity = await AICallActivity.create({
      call_id,
      organization_id,
      call_type,
      number,
    });

    if(newActivity) {
      const sendAiEmail = await vapiService.buildGeminiEmail(newActivity?.call_id)

      if(sendAiEmail) {
        console.log("Ai Activity Email sent to Admins successfully")
      } else {
        console.error("Failed to send email")
      }
    }

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      data: newActivity,
      message: "AI call activity created successfully",
    });
  } catch (error) {
    console.error("Error creating AI call activity:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create AI call activity",
      error: error.message,
    });
  }
};

/**
 * Delete AI call activity by ID
 */
exports.deleteAICallActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await AICallActivity.findById(id);
    if (!activity) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "AI call activity not found",
      });
    }

    // Check if user has access to delete this activity
    if (
      req.user?.organizationId &&
      activity.organization_id.toString() !== req.user.organizationId.toString()
    ) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Access denied to delete this activity",
      });
    }

    await AICallActivity.findByIdAndDelete(id);

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "AI call activity deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting AI call activity:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete AI call activity",
      error: error.message,
    });
  }
};
