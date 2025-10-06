const campaignsService = require("../services/campaigns.service");
const HTTP_STATUS_CODES = require("../../constants/http.status-codes");
const responseHandler = require("../utils/response.handler");

// Create a new campaign
exports.createCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user?.userId || req.body.createdBy,
    };

    const campaign = await campaignsService.createCampaign(campaignData);

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Campaign created successfully",
      201
    );
  } catch (error) {
    console.error("Error creating campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Get all campaigns for an organization
exports.getAllCampaigns = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status,
      isActive: req.query.isActive ? req.query.isActive === "true" : undefined,
    };

    const campaigns = await campaignsService.getAllCampaigns(
      organizationId,
      options
    );

    return responseHandler.handleSuccess(
      res,
      campaigns,
      "Campaigns retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting campaigns:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Get campaign by ID
exports.getCampaignById = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignsService.getCampaignById(campaignId);

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Campaign retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting campaign by ID:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }
};

// Update campaign
exports.updateCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const updateData = req.body;

    const campaign = await campaignsService.updateCampaign(
      campaignId,
      updateData
    );

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Campaign updated successfully"
    );
  } catch (error) {
    console.error("Error updating campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Delete campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    await campaignsService.deleteCampaign(campaignId);

    return responseHandler.handleSuccess(
      res,
      null,
      "Campaign deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Add messages to campaign in bulk
exports.addMessagesToCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return responseHandler.handleError(
        res,
        "Messages must be an array",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    const campaign = await campaignsService.addMessagesToCampaign(
      campaignId,
      messages
    );

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Messages added to campaign successfully"
    );
  } catch (error) {
    console.error("Error adding messages to campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Activate campaign
exports.activateCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignsService.toggleCampaignStatus(
      campaignId,
      true
    );

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Campaign activated successfully"
    );
  } catch (error) {
    console.error("Error activating campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Deactivate campaign
exports.deactivateCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await campaignsService.toggleCampaignStatus(
      campaignId,
      false
    );

    return responseHandler.handleSuccess(
      res,
      campaign,
      "Campaign deactivated successfully"
    );
  } catch (error) {
    console.error("Error deactivating campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// CAMPAIGN LEADS ENDPOINTS

// Add single lead to campaign
exports.addLeadToCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const leadData = req.body;

    const lead = await campaignsService.addLeadToCampaign(campaignId, leadData);

    return responseHandler.handleSuccess(
      res,
      lead,
      "Lead added to campaign successfully",
      201
    );
  } catch (error) {
    console.error("Error adding lead to campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Add multiple leads to campaign (bulk insert)
exports.addLeadsToCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { leads } = req.body;

    if (!Array.isArray(leads)) {
      return responseHandler.handleError(
        res,
        "Leads must be an array",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    const insertedLeads = await campaignsService.addLeadsToCampaign(
      campaignId,
      leads
    );

    return responseHandler.handleSuccess(
      res,
      { addedLeads: insertedLeads, totalAdded: insertedLeads.length },
      `${insertedLeads.length} leads added to campaign successfully`,
      201
    );
  } catch (error) {
    console.error("Error adding leads to campaign:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Get all leads for a campaign
exports.getCampaignLeads = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status,
    };

    const leads = await campaignsService.getCampaignLeads(campaignId, options);

    return responseHandler.handleSuccess(
      res,
      leads,
      "Campaign leads retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting campaign leads:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Update campaign lead
exports.updateCampaignLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const updateData = req.body;

    const lead = await campaignsService.updateCampaignLead(leadId, updateData);

    return responseHandler.handleSuccess(
      res,
      lead,
      "Campaign lead updated successfully"
    );
  } catch (error) {
    console.error("Error updating campaign lead:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Delete campaign lead
exports.deleteCampaignLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    await campaignsService.deleteCampaignLead(leadId);

    return responseHandler.handleSuccess(
      res,
      null,
      "Campaign lead deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting campaign lead:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Get campaign statistics
exports.getCampaignStats = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats = await campaignsService.getCampaignStats(campaignId);

    return responseHandler.handleSuccess(
      res,
      stats,
      "Campaign statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting campaign stats:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// MESSAGING SEQUENCE ENDPOINTS

// Create messaging sequence
exports.createMessagingSequence = async (req, res) => {
  try {
    const sequenceData = req.body;
    const sequence = await campaignsService.createMessagingSequence(
      sequenceData
    );

    return responseHandler.handleSuccess(
      res,
      sequence,
      "Messaging sequence created successfully",
      201
    );
  } catch (error) {
    console.error("Error creating messaging sequence:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Get messaging sequences for a campaign
exports.getMessagingSequences = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status,
      leadId: req.query.leadId,
    };

    const sequences = await campaignsService.getMessagingSequences(
      campaignId,
      options
    );

    return responseHandler.handleSuccess(
      res,
      sequences,
      "Messaging sequences retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting messaging sequences:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};

// Update messaging sequence
exports.updateMessagingSequence = async (req, res) => {
  try {
    const { sequenceId } = req.params;
    const updateData = req.body;

    const sequence = await campaignsService.updateMessagingSequence(
      sequenceId,
      updateData
    );

    return responseHandler.handleSuccess(
      res,
      sequence,
      "Messaging sequence updated successfully"
    );
  } catch (error) {
    console.error("Error updating messaging sequence:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.BAD_REQUEST
    );
  }
};
