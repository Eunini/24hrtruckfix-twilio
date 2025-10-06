const Campaign = require("../models/campaign.model");
const CampaignLeads = require("../models/campaignLeads.model");
const CampaignMessagingSequence = require("../models/campaignMessagingSequence.model");
const twilioService = require("./twilio.service");
const {
  Types: { ObjectId },
} = require("mongoose");

/**
 * Check if a campaign is active
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<boolean>} - True if campaign is active
 */
exports.isCampaignActive = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check campaign status - don't process if completed or paused
    if (campaign.status === "completed") {
      throw new Error("Campaign is already completed");
    }

    if (campaign.status === "paused") {
      throw new Error("Campaign is paused");
    }

    return (
      campaign.isActive &&
      (campaign.status === "draft" || campaign.status === "active")
    );
  } catch (error) {
    console.error("Error checking campaign status:", error);
    throw error;
  }
};

/**
 * Get all active leads for a specific campaign
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Array>} - Array of active leads
 */
exports.getActiveCampaignLeads = async (campaignId) => {
  try {
    const leads = await CampaignLeads.find({
      campaign_id: campaignId,
      status: "active",
    });
    return leads;
  } catch (error) {
    console.error("Error getting active leads:", error);
    throw new Error("Failed to get active leads");
  }
};

/**
 * Get the next message for a lead based on contact attempt
 * @param {string} campaignId - The campaign ID
 * @param {number} contactAttempt - Current contact attempt number
 * @returns {Promise<Object|null>} - Message object or null if no message found
 */
exports.getNextMessage = async (campaignId, contactAttempt) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (
      !campaign ||
      !campaign.messagesList ||
      campaign.messagesList.length === 0
    ) {
      return null;
    }

    // Get message by index (contactAttempt - 1 since arrays are 0-indexed)
    const messageIndex = contactAttempt - 1;
    if (messageIndex >= 0 && messageIndex < campaign.messagesList.length) {
      return campaign.messagesList[messageIndex];
    }

    return null;
  } catch (error) {
    console.error("Error getting next message:", error);
    throw new Error("Failed to get next message");
  }
};

/**
 * Send SMS to a lead
 * @param {string} phoneNumber - Lead's phone number
 * @param {string} message - Message to send
 * @param {string} leadId - lead's id
 * @returns {Promise<Object>} - Twilio response
 */
exports.sendSMSToLead = async (phoneNumber, message, leadId) => {
  try {
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      throw new Error("TWILIO_PHONE_NUMBER not configured");
    }

    const result = await twilioService.sendSMS(
      phoneNumber,
      fromNumber,
      message.message,
      true
    );

    if (!result.sid) {
      // Check if error is related to invalid number or unreachable location
      if (
        result.code === 21211 || // Invalid number
        result.code === 21612 || // Not a mobile number
        result.code === 21408 || // Cannot route to this number
        result.code === 21614
      ) {
        // Not a valid mobile number
        // Disable the lead by setting status to inactive

        const updatedLead = await CampaignLeads.findOneAndUpdate(
          { _id: leadId },
          { status: "inactive", notes: `Invalid number: ${result.message}` },
          { new: true, runValidators: true }
        );

        if (!updatedLead) {
          throw new Error(`Failed to update lead status for ID: ${leadId}`);
        }
        throw new Error(
          `Lead disabled - Invalid number or unreachable: ${result.message}`
        );
      }
    }

    return result;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Process a single lead with timer logic - respects 10-minute gaps between messages
 * @param {Object} lead - The lead object
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing result
 */
exports.processIndividualLeadWithTimer = async (lead, campaignId) => {
  try {
    // Check if lead is active
    if (lead.status !== "active") {
      return {
        success: false,
        leadId: lead._id,
        reason: "Lead is not active",
      };
    }

    // Check if enough time has passed since last contact (based on nextContactHourInterval)
    if (lead.lastContactedAt) {
      // Get the next message to check its interval
      const nextAttempt = (lead.contactAttempts || 0) + 1;
      const campaign = await Campaign.findById(campaignId);
      
      if (campaign && campaign.messagesList && campaign.messagesList.length > 0) {
        const messageIndex = nextAttempt - 1;
        if (messageIndex < campaign.messagesList.length) {
          const nextMessage = campaign.messagesList[messageIndex];
          const hourInterval = nextMessage.nextContactHourInterval || 1;
          const intervalMs = hourInterval * 60 * 60 * 1000; // Convert hours to milliseconds
          const thresholdTime = new Date(Date.now() - intervalMs);
          
          if (lead.lastContactedAt > thresholdTime) {
            const timeRemaining = Math.ceil((lead.lastContactedAt.getTime() + intervalMs - Date.now()) / 1000 / 60);
            return {
              success: false,
              leadId: lead._id,
              reason: `Timer not ready - ${timeRemaining} minutes remaining (${hourInterval}h interval)`,
              waitTime: timeRemaining,
            };
          }
        }
      }
    }

    // Get current contact attempt and increment
    const currentAttempt = (lead.contactAttempts || 0) + 1;

    // Get the message for this attempt
    const message = await this.getNextMessage(campaignId, currentAttempt);
    if (!message) {
      lead.status = "inactive";
      lead.save();
      return {
        success: true,
        leadId: lead._id,
        reason: "No message available for this contact attempt - lead marked inactive",
      };
    }

    // Send SMS
    const smsResult = await this.sendSMSToLead(
      lead.phoneNumber,
      message.content || message.text || message,
      lead._id
    );

    // Update contact attempt and last contacted time in database
    const updatedLead = await CampaignLeads.findByIdAndUpdate(
      lead._id,
      {
        contactAttempts: currentAttempt,
        lastContactedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      throw new Error(`Failed to update lead ${lead._id}`);
    }

    // Create messaging sequence record for tracking
    await this.createMessagingSequenceRecord({
      leadId: lead._id,
      campaignId,
      messageId: message._id,
      messageContent: message.content || message.text || message,
      sequenceOrder: currentAttempt,
      smsResult: smsResult.sid,
    });

    return {
      success: true,
      leadId: lead._id,
      contactAttempt: currentAttempt,
      messageSent: message.content || message.text || message,
      messageId: message._id,
      smsResult: smsResult.sid,
      nextScheduledAt: new Date(Date.now() + (message.nextContactHourInterval || 1) * 60 * 60 * 1000), // Next message based on hour interval
    };
  } catch (error) {
    console.error(`Error processing lead ${lead._id} with timer:`, error);
    return {
      success: false,
      leadId: lead._id,
      error: error.message,
    };
  }
};

/**
 * Create a messaging sequence record for tracking
 * @param {Object} params - Parameters for creating the record
 * @returns {Promise<Object>} - Created record
 */
exports.createMessagingSequenceRecord = async ({
  leadId,
  campaignId,
  messageId,
  messageContent,
  sequenceOrder,
  smsResult,
}) => {
  try {
    const sequenceRecord = new CampaignMessagingSequence({
      campaignLead_id: leadId,
      campaign_id: campaignId,
      messageId: messageId,
      lastMessage: messageContent,
      sequenceOrder: sequenceOrder,
      status: "sent",
      scheduledAt: new Date(),
      sentAt: new Date(),
      nextScheduledAt: new Date(Date.now() + (messageContent.nextContactHourInterval || 1) * 60 * 60 * 1000), // Next message based on hour interval
      messageType: "sms",
      retryCount: 0,
    });

    await sequenceRecord.save();
    return sequenceRecord;
  } catch (error) {
    console.error("Error creating messaging sequence record:", error);
    throw error;
  }
};

/**
 * Get leads that are ready for their next message (based on nextContactHourInterval)
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Array>} - Array of leads ready for next message
 */
exports.getLeadsReadyForNextMessage = async (campaignId) => {
  try {
    // Get campaign to access messagesList with nextContactHourInterval
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || !campaign.messagesList || campaign.messagesList.length === 0) {
      return [];
    }

    // Get all active leads for this campaign
    const activeLeads = await CampaignLeads.find({
      campaign_id: campaignId,
      status: "active"
    });

    const readyLeads = [];

    for (const lead of activeLeads) {
      // If never contacted, lead is ready
      if (!lead.lastContactedAt) {
        readyLeads.push(lead);
        continue;
      }

      // Get the next message based on contact attempts
      const nextAttempt = (lead.contactAttempts || 0) + 1;
      const messageIndex = nextAttempt - 1;
      
      // If no more messages available, skip this lead
      if (messageIndex >= campaign.messagesList.length) {
        continue;
      }

      const nextMessage = campaign.messagesList[messageIndex];
      const hourInterval = nextMessage.nextContactHourInterval || 1;
      
      // Calculate time threshold based on hour interval
      const intervalMs = hourInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      const thresholdTime = new Date(Date.now() - intervalMs);

      // Check if enough time has passed since last contact
      if (lead.lastContactedAt <= thresholdTime) {
        readyLeads.push(lead);
      }
    }

    return readyLeads;
  } catch (error) {
    console.error("Error getting leads ready for next message:", error);
    throw error;
  }
};

/**
 * Process campaign with timer logic - only sends messages to leads that are ready
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing summary
 */
exports.processCampaignWithTimer = async (campaignId) => {
  try {
    // Check if campaign is active
    const isActive = await this.isCampaignActive(campaignId);
    if (!isActive) {
      return {
        success: false,
        campaignId,
        reason: "Campaign is not active",
      };
    }

    // Set campaign status to 'active' when processing starts
    await Campaign.findByIdAndUpdate(campaignId, { status: "active" });

    // Get leads that are ready for their next message
    const readyLeads = await this.getLeadsReadyForNextMessage(campaignId);
    if (readyLeads.length === 0) {
      return {
        success: true,
        campaignId,
        message: "No leads ready for next message (timer not elapsed)",
        processed: 0,
        results: [],
      };
    }

    // Process each ready lead
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let timerNotReadyCount = 0;

    for (const lead of readyLeads) {
      const result = await this.processIndividualLeadWithTimer(lead, campaignId);
      results.push(result);

      if (result.success) {
        successCount++;
      } else if (result.reason && result.reason.includes("Timer not ready")) {
        timerNotReadyCount++;
      } else {
        failureCount++;
      }
    }

    // Check if campaign should be marked as completed
    const isCompleted = await checkAndUpdateCampaignCompletion(campaignId);

    return {
      success: true,
      campaignId,
      processed: readyLeads.length,
      successCount,
      failureCount,
      timerNotReadyCount,
      results,
      campaignCompleted: isCompleted,
    };
  } catch (error) {
    console.error(`Error processing campaign ${campaignId} with timer:`, error);
    return {
      success: false,
      campaignId,
      error: error.message,
    };
  }
};

/**
 * Process a single lead - check status, get message, send SMS, update attempt
 * @param {Object} lead - The lead object
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing result
 */
exports.processIndividualLead = async (lead, campaignId) => {
  try {
    // Check if lead is active
    if (lead.status !== "active") {
      return {
        success: false,
        leadId: lead._id,
        reason: "Lead is not active",
      };
    }

    // Get current contact attempt and increment
    const currentAttempt = (lead.contactAttempts || 0) + 1;

    // Get the message for this attempt
    const message = await this.getNextMessage(campaignId, currentAttempt);
    if (!message) {
      lead.status = "inactive";
      lead.save();
      return {
        success: true,
        leadId: lead._id,
        reason: "No message available for this contact attempt",
      };
    }

    // Send SMS
    const smsResult = await this.sendSMSToLead(
      lead.phoneNumber,
      message.content || message.text || message,
      lead._id
    );

    // Update contact attempt in database
    const updatedLead = await CampaignLeads.findByIdAndUpdate(
      lead._id,
      {
        contactAttempts: currentAttempt, // ✅ Correct field name (with 's')
        lastContactedAt: new Date(), // ✅ Correct field name
      },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      throw new Error(`Failed to update lead ${lead._id}`);
    }

    return {
      success: true,
      leadId: lead._id,
      contactAttempt: currentAttempt,
      messageSent: message.content || message.text || message,
      smsResult: smsResult.sid,
    };
  } catch (error) {
    console.error(`Error processing lead ${lead._id}:`, error);
    return {
      success: false,
      leadId: lead._id,
      error: error.message,
    };
  }
};

/**
 * Process entire campaign - send messages to all active leads
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing summary
 */
exports.processCampaign = async (campaignId) => {
  try {
    // Check if campaign is active
    const isActive = await this.isCampaignActive(campaignId);
    if (!isActive) {
      return {
        success: false,
        campaignId,
        reason: "Campaign is not active",
      };
    }

    // Set campaign status to 'active' when processing starts
    await Campaign.findByIdAndUpdate(campaignId, { status: "active" });

    // Get all active leads
    const activeLeads = await this.getActiveCampaignLeads(campaignId);
    if (activeLeads.length === 0) {
      return {
        success: true,
        campaignId,
        message: "No active leads found for this campaign",
        processed: 0,
        results: [],
      };
    }

    // Process each lead
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const lead of activeLeads) {
      const result = await this.processIndividualLead(lead, campaignId);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Check if campaign should be marked as completed
    const isCompleted = await checkAndUpdateCampaignCompletion(campaignId);

    return {
      success: true,
      campaignId,
      processed: activeLeads.length,
      successCount,
      failureCount,
      results,
      campaignCompleted: isCompleted,
    };
  } catch (error) {
    console.error(`Error processing campaign ${campaignId}:`, error);
    return {
      success: false,
      campaignId,
      error: error.message,
    };
  }
};

/**
 * Process a single lead by lead ID
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} - Processing result
 */
exports.processLeadById = async (leadId) => {
  try {
    const lead = await CampaignLeads.findById(leadId);
    if (!lead) {
      return {
        success: false,
        leadId,
        reason: "Lead not found",
      };
    }

    // Check if campaign is active
    const isActive = await this.isCampaignActive(lead.campaign_id);
    if (!isActive) {
      return {
        success: false,
        leadId,
        reason: "Campaign is not active",
      };
    }

    // Set campaign status to 'active' when processing starts
    await Campaign.findByIdAndUpdate(lead.campaign_id, { status: "active" });

    const result = await this.processIndividualLead(lead, lead.campaign_id);

    // Check if campaign should be marked as completed
    const isCompleted = await checkAndUpdateCampaignCompletion(
      lead.campaign_id
    );

    return {
      ...result,
      campaignCompleted: isCompleted,
    };
  } catch (error) {
    console.error(`Error processing lead by ID ${leadId}:`, error);
    return {
      success: false,
      leadId,
      error: error.message,
    };
  }
};

/**
 * Mark a lead as contacted - increment contact attempts and update timestamp
 * @param {string} identifier - The lead ID or phone number
 * @param {string} notes - Optional notes about the contact
 * @returns {Promise<Object>} - Update result
 */
exports.markLeadAsContacted = async (identifier, notes = null) => {
  try {
    // Try to find lead by ID first, then by phone number
    let lead;

    // Check if identifier looks like a MongoDB ObjectId (24 hex characters)
    if (identifier && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      lead = await CampaignLeads.findById(identifier);
    }

    // If not found by ID or doesn't look like ObjectId, try phone number
    if (!lead) {
      lead = await CampaignLeads.findOne({ phoneNumber: identifier });
    }

    if (!lead) {
      throw new Error("Lead not found with the provided identifier");
    }

    if (lead.status !== "active") {
      throw new Error("Lead is not active");
    }

    // Get current contact attempt and increment
    // const currentAttempt = (lead.contactAttempts || 0) + 1;

    // Update the lead
    const updateData = {
      // contactAttempts: currentAttempt,
      // lastContactedAt: new Date()
      status: "contacted",
    };

    // Add notes if provided
    if (notes) {
      updateData.notes = notes;
    }

    const updatedLead = await CampaignLeads.findByIdAndUpdate(
      lead._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      throw new Error(`Failed to update lead ${lead._id}`);
    }

    // Check if campaign should be marked as completed
    const isCompleted = await checkAndUpdateCampaignCompletion(
      lead.campaign_id
    );

    return {
      success: true,
      leadId: lead._id,
      phoneNumber: lead.phoneNumber,
      lastContactedAt: updatedLead.lastContactedAt,
      notes: updatedLead.notes,
      campaignCompleted: isCompleted,
    };
  } catch (error) {
    console.error(`Error marking lead as contacted ${identifier}:`, error);
    return {
      success: false,
      identifier: identifier,
      error: error.message,
    };
  }
};

// Check if campaign should be marked as completed
const checkAndUpdateCampaignCompletion = async (campaignId) => {
  try {
    console.log("Checking completion for campaignId:", campaignId);

    // Get all leads for this campaign - use campaign_id (with underscore)
    const totalLeads = await CampaignLeads.countDocuments({
      campaign_id: campaignId,
      status: "active",
    });

    console.log("Total active leads found:", totalLeads);

    if (totalLeads === 0) {
      // No active leads left, mark campaign as completed
      console.log("No active leads remaining, marking campaign as completed");
      await Campaign.findByIdAndUpdate(campaignId, { status: "completed" });
      return true;
    }

    console.log(`Campaign still has ${totalLeads} active leads`);
    return false;
  } catch (error) {
    console.error("Error checking campaign completion:", error);
    return false;
  }
};

// module.exports = {
//   // isCampaignActive,
//   // getActiveCampaignLeads,
//   // processIndividualLead,
//   // processCampaign,
//   // processLeadById,
//   checkAndUpdateCampaignCompletion,
// };
