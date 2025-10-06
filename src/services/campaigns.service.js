const Campaign = require("../models/campaign.model");
const CampaignLeads = require("../models/campaignLeads.model");
const CampaignMessagingSequence = require("../models/campaignMessagingSequence.model");
const processCampaignService = require("./process-campaign.service");
const campaignTimerService = require("./campaign-timer.service");
const {
  Types: { ObjectId },
} = require("mongoose");

// Create a new campaign
exports.createCampaign = async (campaignData) => {
  const requiredFields = ["name", "organization_id", "createdBy"];
  for (const field of requiredFields) {
    if (!campaignData[field]) throw new Error(`${field} is required`);
  }

  // Validate messagesList if provided
  if (campaignData.messagesList && Array.isArray(campaignData.messagesList)) {
    for (const msg of campaignData.messagesList) {
      if (!msg.id || !msg.message) {
        throw new Error("Each message must have id and message fields");
      }

      // Validate nextContactHourInterval if provided
      if (msg.nextContactHourInterval !== undefined) {
        if (
          typeof msg.nextContactHourInterval !== "number" ||
          msg.nextContactHourInterval < 1
        ) {
          throw new Error(
            "nextContactHourInterval must be a number with minimum value of 1"
          );
        }
      }
    }
  }

  const newCampaign = await Campaign.create({
    ...campaignData,
    messagesList: campaignData.messagesList || [],
  });

  return newCampaign;
};

// Get all campaigns for an organization
exports.getAllCampaigns = async (organizationId, options = {}) => {
  const { page = 1, limit = 10, status, isActive } = options;

  const query = { organization_id: organizationId };
  if (status) query.status = status;
  if (typeof isActive !== "undefined") query.isActive = isActive;
  console.log("query", query);
  const campaigns = await Campaign.paginate(query, {
    page,
    limit,
    populate: [
      { path: "organization_id", select: "companyName" },
      { path: "createdBy", select: "firstname lastname email" },
    ],
    sort: { createdAt: -1 },
  });

  console.log("campaigns", campaigns);

  return campaigns;
};

// Get campaign by ID
exports.getCampaignById = async (campaignId) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const campaign = await Campaign.findById(campaignId)
    .populate("organization_id", "companyName")
    .populate("createdBy", "firstname lastname email");

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  return campaign;
};

// Update campaign
exports.updateCampaign = async (campaignId, updateData) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    updateData,
    { new: true, runValidators: true }
  )
    .populate("organization_id", "companyName")
    .populate("createdBy", "firstname lastname email");

  if (!updatedCampaign) {
    throw new Error("Campaign not found");
  }

  return updatedCampaign;
};

// Delete campaign
exports.deleteCampaign = async (campaignId) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  // Also delete associated leads and messaging sequences
  await CampaignLeads.deleteMany({ campaign_id: campaignId });
  await CampaignMessagingSequence.deleteMany({ campaign_id: campaignId });

  const deletedCampaign = await Campaign.findByIdAndDelete(campaignId);
  if (!deletedCampaign) {
    throw new Error("Campaign not found");
  }

  return deletedCampaign;
};

// Add messages to campaign in bulk
exports.addMessagesToCampaign = async (campaignId, messages) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array is required and cannot be empty");
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.id || !msg.message) {
      throw new Error("Each message must have id and message fields");
    }

    // Validate nextContactHourInterval if provided
    if (msg.nextContactHourInterval !== undefined) {
      if (
        typeof msg.nextContactHourInterval !== "number" ||
        msg.nextContactHourInterval < 1
      ) {
        throw new Error(
          "nextContactHourInterval must be a number with minimum value of 1"
        );
      }
    }
  }

  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    { $push: { messagesList: { $each: messages } } },
    { new: true, runValidators: true }
  );

  if (!updatedCampaign) {
    throw new Error("Campaign not found");
  }

  return updatedCampaign;
};

// Activate/Deactivate campaign
exports.toggleCampaignStatus = async (campaignId, isActive) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    {
      isActive: isActive,
      status: isActive ? "active" : "paused",
    },
    { new: true, runValidators: true }
  );

  if (!updatedCampaign) {
    throw new Error("Campaign not found");
  }

  // If campaign is being activated, trigger immediate processing
  if (isActive && updatedCampaign.status === "active") {
    try {
      console.log(`🚀 Campaign ${campaignId} activated - triggering immediate processing`);
      
      // Process the campaign immediately in the background
      setImmediate(async () => {
        try {
          await campaignTimerService.processCampaignWithTimer(campaignId);
          console.log(`✅ Immediate processing completed for campaign ${campaignId}`);
        } catch (error) {
          console.error(`❌ Error in immediate processing for campaign ${campaignId}:`, error);
        }
      });
      
    } catch (error) {
      console.error(`⚠️ Error triggering immediate processing for campaign ${campaignId}:`, error);
      // Don't throw error here as the campaign activation was successful
    }
  }

  return updatedCampaign;
};

// CAMPAIGN LEADS OPERATIONS

// Add single lead to campaign
exports.addLeadToCampaign = async (campaignId, leadData) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const newLead = await CampaignLeads.create({
    ...leadData,
    campaign_id: campaignId,
    organization_id: campaign.organization_id,
  });

  // Process first message immediately if campaign is active and has messages
  if (campaign.isActive && campaign.status === "active" && campaign.messagesList && campaign.messagesList.length > 0) {
    try {
      await exports.processFirstMessageForLead(newLead, campaign);
    } catch (error) {
      console.error(`Error processing first message for lead ${newLead._id}:`, error);
      // Don't throw error here - lead was created successfully, message processing can be retried
    }
  }

  return newLead;
};

// Add multiple leads to campaign (insertMany)
exports.addLeadsToCampaign = async (campaignId, leadsData) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  if (!Array.isArray(leadsData) || leadsData.length === 0) {
    throw new Error("Leads data array is required and cannot be empty");
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Prepare leads data with campaign and organization references
  const preparedLeads = leadsData.map((lead) => ({
    ...lead,
    campaign_id: campaignId,
    organization_id: campaign.organization_id,
  }));

  const insertedLeads = await CampaignLeads.insertMany(preparedLeads, {
    ordered: false, // Continue inserting even if some fail
  });

  // Process first message for all newly added leads if campaign is active
  if (campaign.isActive && campaign.status === "active" && campaign.messagesList && campaign.messagesList.length > 0) {
    console.log(`Processing first message for ${insertedLeads.length} newly added leads`);
    
    // Process leads in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < insertedLeads.length; i += batchSize) {
      const batch = insertedLeads.slice(i, i + batchSize);
      
      // Process batch concurrently but with controlled concurrency
      const batchPromises = batch.map(async (lead) => {
        try {
          await exports.processFirstMessageForLead(lead, campaign);
        } catch (error) {
          console.error(`Error processing first message for lead ${lead._id}:`, error);
          // Continue processing other leads even if one fails
        }
      });
      
      await Promise.allSettled(batchPromises);
      
      // Small delay between batches to prevent rate limiting
      if (i + batchSize < insertedLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return insertedLeads;
};

// Get all leads for a campaign
exports.getCampaignLeads = async (campaignId, options = {}) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const { page = 1, limit = 10, status } = options;

  const query = { campaign_id: campaignId };
  if (status) query.status = status;

  const leads = await CampaignLeads.paginate(query, {
    page,
    limit,
    populate: [{ path: "campaign_id", select: "name" }],
    sort: { createdAt: -1 },
  });

  return leads;
};

// Update lead
exports.updateCampaignLead = async (leadId, updateData) => {
  if (!ObjectId.isValid(leadId)) {
    throw new Error("Invalid lead ID");
  }

  const updatedLead = await CampaignLeads.findByIdAndUpdate(
    leadId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedLead) {
    throw new Error("Lead not found");
  }

  return updatedLead;
};

// Delete lead
exports.deleteCampaignLead = async (leadId) => {
  if (!ObjectId.isValid(leadId)) {
    throw new Error("Invalid lead ID");
  }

  // Also delete associated messaging sequences
  await CampaignMessagingSequence.deleteMany({ campaignLead_id: leadId });

  const deletedLead = await CampaignLeads.findByIdAndDelete(leadId);
  if (!deletedLead) {
    throw new Error("Lead not found");
  }

  return deletedLead;
};

// CAMPAIGN MESSAGING SEQUENCE OPERATIONS

// Create messaging sequence
exports.createMessagingSequence = async (sequenceData) => {
  const requiredFields = [
    "message",
    "campaign_id",
    "campaignLead_id",
    "organization_id",
  ];
  for (const field of requiredFields) {
    if (!sequenceData[field]) throw new Error(`${field} is required`);
  }

  const newSequence = await CampaignMessagingSequence.create(sequenceData);
  return newSequence;
};

// Get messaging sequences for a campaign
exports.getMessagingSequences = async (campaignId, options = {}) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const { page = 1, limit = 10, status, leadId } = options;

  const query = { campaign_id: campaignId };
  if (status) query.status = status;
  if (leadId) query.campaignLead_id = leadId;

  const sequences = await CampaignMessagingSequence.paginate(query, {
    page,
    limit,
    populate: [
      { path: "campaign_id", select: "name" },
      { path: "campaignLead_id", select: "name phoneNumber" },
    ],
    sort: { sequenceOrder: 1, createdAt: -1 },
  });

  return sequences;
};

// Update messaging sequence
exports.updateMessagingSequence = async (sequenceId, updateData) => {
  if (!ObjectId.isValid(sequenceId)) {
    throw new Error("Invalid sequence ID");
  }

  const updatedSequence = await CampaignMessagingSequence.findByIdAndUpdate(
    sequenceId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedSequence) {
    throw new Error("Messaging sequence not found");
  }

  return updatedSequence;
};

// Get campaign statistics
exports.getCampaignStats = async (campaignId) => {
  if (!ObjectId.isValid(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const totalLeads = await CampaignLeads.countDocuments({
    campaign_id: campaignId,
  });
  const activeLeads = await CampaignLeads.countDocuments({
    campaign_id: campaignId,
    status: "active",
  });
  const contactedLeads = await CampaignLeads.countDocuments({
    campaign_id: campaignId,
    status: "contacted",
  });

  const totalMessages = await CampaignMessagingSequence.countDocuments({
    campaign_id: campaignId,
  });
  const sentMessages = await CampaignMessagingSequence.countDocuments({
    campaign_id: campaignId,
    status: "sent",
  });
  const deliveredMessages = await CampaignMessagingSequence.countDocuments({
    campaign_id: campaignId,
    status: "delivered",
  });

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      status: campaign.status,
      isActive: campaign.isActive,
      messagesCount: campaign.messagesList.length,
    },
    leads: {
      total: totalLeads,
      active: activeLeads,
      contacted: contactedLeads,
      inactive: totalLeads - activeLeads - contactedLeads,
    },
    messages: {
      total: totalMessages,
      sent: sentMessages,
      delivered: deliveredMessages,
      pending: totalMessages - sentMessages,
    },
  };
};

// FIRST MESSAGE PROCESSING FOR NEW LEADS

/**
 * Process the first message for a newly added lead
 * @param {Object} lead - The lead object
 * @param {Object} campaign - The campaign object
 * @returns {Promise<Object>} - Processing result
 */
exports.processFirstMessageForLead = async (lead, campaign) => {
  try {
    console.log(`🚀 Processing first message for lead ${lead._id} in campaign ${campaign.name}`);

    // Get the first message from the campaign
    if (!campaign.messagesList || campaign.messagesList.length === 0) {
      throw new Error("No messages available in campaign");
    }

    const firstMessage = campaign.messagesList[0];
    
    // Send SMS using the process-campaign service
    const smsResult = await processCampaignService.sendSMSToLead(
      lead.phoneNumber,
      firstMessage,
      lead._id
    );

    // Update lead with first contact information
    const updatedLead = await CampaignLeads.findByIdAndUpdate(
      lead._id,
      {
        contactAttempts: 1,
        lastContactedAt: new Date(),
        status: "contacted"
      },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      throw new Error(`Failed to update lead ${lead._id}`);
    }

    // Create messaging sequence record for tracking
    await CampaignMessagingSequence.create({
      message: firstMessage.message,
      campaign_id: campaign._id,
      campaignLead_id: lead._id,
      organization_id: lead.organization_id,
      sequenceOrder: 1,
      status: "sent",
      scheduledAt: new Date(),
      sentAt: new Date(),
      messageType: "sms",
      lastMessage: firstMessage.message,
      messageId: firstMessage._id || firstMessage.id,
      nextScheduledAt: new Date(Date.now() + (firstMessage.nextContactHourInterval || 1) * 60 * 60 * 1000)
    });

    console.log(`✅ First message sent successfully to lead ${lead._id}`);

    return {
      success: true,
      leadId: lead._id,
      messageSent: true,
      messageContent: firstMessage.message,
      smsResult: smsResult.sid,
      nextScheduledAt: new Date(Date.now() + (firstMessage.nextContactHourInterval || 1) * 60 * 60 * 1000)
    };

  } catch (error) {
    console.error(`❌ Error processing first message for lead ${lead._id}:`, error);
    throw error;
  }
};
