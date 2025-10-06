const Campaign = require("../models/campaign.model");
const CampaignLeads = require("../models/campaignLeads.model");
const CampaignMessagingSequence = require("../models/campaignMessagingSequence.model");
const processCampaignService = require("./process-campaign.service");

/**
 * Process all active campaigns and send messages with timer logic
 * @returns {Promise<Object>} - Processing summary
 */
exports.processActiveCampaignsWithTimer = async () => {
  try {
    console.log(`🔄 [${new Date().toISOString()}] Starting campaign timer processing...`);
    
    // Get all active campaigns
    const activeCampaigns = await Campaign.find({
      isActive: true,
      status: "active"
    });

    if (activeCampaigns.length === 0) {
      return {
        success: true,
        message: "No active campaigns found",
        processed: 0,
        results: []
      };
    }

    console.log(`📋 Found ${activeCampaigns.length} active campaigns`);

    const results = [];
    let totalProcessed = 0;
    let totalSent = 0;
    let totalErrors = 0;

    // Process each campaign
    for (const campaign of activeCampaigns) {
      try {
        const campaignResult = await exports.processCampaignWithTimer(campaign._id);
        results.push(campaignResult);
        
        if (campaignResult.success) {
          totalProcessed += campaignResult.processed || 0;
          totalSent += campaignResult.sent || 0;
          totalErrors += campaignResult.errors || 0;
          }
        } catch (error) {
          console.error(`❌ Error processing campaign ${campaign._id}:`, error);
          results.push({
            success: false,
            campaignId: campaign._id,
            campaignName: campaign.name,
            error: error.message
          });
          totalErrors++;
        }
      }

      console.log(`✅ Campaign timer processing completed`);
      console.log(`📊 Total processed: ${totalProcessed}, Sent: ${totalSent}, Errors: ${totalErrors}`);

      return {
        success: true,
        campaignsProcessed: activeCampaigns.length,
        totalProcessed,
        totalSent,
        totalErrors,
        results
      };

    } catch (error) {
      console.error("💥 Error in campaign timer processing:", error);
      throw new Error(`Campaign timer processing failed: ${error.message}`);
    }
};

/**
 * Process a single campaign with timer logic
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing result
 */
exports.processCampaignWithTimer = async (campaignId) => {
  try {
    console.log(`🎯 Processing campaign: ${campaignId}`);

    // Get campaign details
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || !campaign.isActive) {
      return {
        success: false,
        campaignId,
        reason: "Campaign not found or not active"
      };
    }

    // Get leads that are ready for next message (based on timer)
    const readyLeads = await exports.getLeadsReadyForNextMessage(campaignId);
    
    if (readyLeads.length === 0) {
      return {
        success: true,
        campaignId,
        campaignName: campaign.name,
        message: "No leads ready for next message",
        processed: 0,
        sent: 0,
        errors: 0
      };
    }

    console.log(`📞 Found ${readyLeads.length} leads ready for next message in campaign: ${campaign.name}`);

    let processed = 0;
    let sent = 0;
    let errors = 0;
    const leadResults = [];

    // Process each ready lead
    for (const lead of readyLeads) {
      try {
        const result = await exports.processLeadWithTimer(lead, campaignId);
        leadResults.push(result);
        processed++;

        if (result.success && result.messageSent) {
          sent++;
        } else if (!result.success) {
          errors++;
        }

      } catch (error) {
        console.error(`❌ Error processing lead ${lead._id}:`, error);
        errors++;
        leadResults.push({
          success: false,
          leadId: lead._id,
          error: error.message
        });
      }
    }

    return {
      success: true,
      campaignId,
      campaignName: campaign.name,
      processed,
      sent,
      errors,
      leadResults
  };

  } catch (error) {
    console.error(`💥 Error processing campaign ${campaignId}:`, error);
    throw error;
  }
};

/**
 * Get leads that are ready for their next message based on nextContactHourInterval
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
    console.error("Error getting ready leads:", error);
    throw new Error("Failed to get leads ready for next message");
  }
};

/**
 * Process a single lead with timer logic
 * @param {Object} lead - The lead object
 * @param {string} campaignId - The campaign ID
 * @returns {Promise<Object>} - Processing result
 */
exports.processLeadWithTimer = async (lead, campaignId) => {
  try {
    // Check if lead is still active
    if (lead.status !== "active") {
      return {
        success: false,
        leadId: lead._id,
        reason: "Lead is not active"
      };
    }

    // Get current contact attempt and increment
    const currentAttempt = (lead.contactAttempts || 0) + 1;

    // Get the message for this attempt
    const message = await processCampaignService.getNextMessage(campaignId, currentAttempt);
    if (!message) {
      // No more messages available, mark lead as completed
      await CampaignLeads.findByIdAndUpdate(lead._id, { 
        status: "completed",
        notes: "All messages sent" 
      });
      
      return {
        success: true,
        leadId: lead._id,
        reason: "No more messages available - lead completed"
      };
    }

    // Send SMS using existing service
    const smsResult = await processCampaignService.sendSMSToLead(
      lead.phoneNumber,
      message,
      lead._id
    );

    // Update lead with new contact attempt and timestamp
    const updatedLead = await CampaignLeads.findByIdAndUpdate(
      lead._id,
      {
        contactAttempts: currentAttempt,
        lastContactedAt: new Date(),
        status: "contacted"
      },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      throw new Error(`Failed to update lead ${lead._id}`);
    }

    // Create/update messaging sequence record for tracking
    await exports.createMessagingSequenceRecord(
      lead._id,
      campaignId,
      message,
      currentAttempt,
        smsResult
      );

    console.log(`✅ Message sent to lead ${lead._id} (attempt ${currentAttempt})`);

    return {
      success: true,
      leadId: lead._id,
      contactAttempt: currentAttempt,
      messageSent: true,
      messageContent: message.message,
      smsResult: smsResult.sid
    };

  } catch (error) {
    console.error(`❌ Error processing lead ${lead._id}:`, error);
    return {
      success: false,
      leadId: lead._id,
      error: error.message
    };
  }
};

/**
 * Create a messaging sequence record for tracking
 * @param {string} leadId - The lead ID
 * @param {string} campaignId - The campaign ID
 * @param {Object} message - The message object
 * @param {number} sequenceOrder - The sequence order
 * @param {Object} smsResult - The SMS result from Twilio
 */
exports.createMessagingSequenceRecord = async (leadId, campaignId, message, sequenceOrder, smsResult) => {
  try {
    // Get lead details for organization_id
    const lead = await CampaignLeads.findById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    const sequenceData = {
      message: message.message,
      campaign_id: campaignId,
      campaignLead_id: leadId,
      organization_id: lead.organization_id,
      sequenceOrder: sequenceOrder,
      status: "sent",
      scheduledAt: new Date(),
      sentAt: new Date(),
      messageType: "sms",
      lastMessage: message.message,
      messageId: message._id || message.id,
      nextScheduledAt: new Date(Date.now() + (message.nextContactHourInterval || 1) * 60 * 60 * 1000) // Next message based on hour interval
    };

    await CampaignMessagingSequence.create(sequenceData);
    console.log(`📝 Created messaging sequence record for lead ${leadId}`);

  } catch (error) {
    console.error("Error creating messaging sequence record:", error);
    // Don't throw error here as the message was already sent successfully
  }
};

/**
 * Get campaign timer statistics
 * @returns {Promise<Object>} - Timer statistics
 */
exports.getTimerStats = async () => {
  try {
    const activeCampaigns = await Campaign.countDocuments({
      isActive: true,
      status: "active"
    });

    const totalLeads = await CampaignLeads.countDocuments({
      status: { $in: ["active", "contacted"] }
    });

    // Calculate ready leads using the new interval-based logic
    let readyLeadsCount = 0;
    const activeCampaignsList = await Campaign.find({
      isActive: true,
      status: "active"
    });

    for (const campaign of activeCampaignsList) {
      const readyLeads = await exports.getLeadsReadyForNextMessage(campaign._id);
      readyLeadsCount += readyLeads.length;
    }

    const recentMessages = await CampaignMessagingSequence.countDocuments({
      sentAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    return {
      activeCampaigns,
      totalLeads,
      readyLeads: readyLeadsCount,
      recentMessages,
      nextProcessingInfo: "Based on individual message nextContactHourInterval settings"
    };

  } catch (error) {
    console.error("Error getting timer stats:", error);
    throw new Error("Failed to get timer statistics");
  }
};