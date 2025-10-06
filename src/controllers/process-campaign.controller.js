const processCampaignService = require('../services/process-campaign.service');
const HTTP_STATUS_CODES = require('../../constants/http.status-codes');
const responseHandler = require('../utils/response.handler');

/**
 * Process entire campaign - send messages to all active leads
 */
exports.processCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    if (!campaignId) {
      return responseHandler.handleError(res, 'Campaign ID is required', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const result = await processCampaignService.processCampaign(campaignId);
    
    if (!result.success) {
      return responseHandler.handleError(res, result.reason || result.error, HTTP_STATUS_CODES.BAD_REQUEST);
    }

    return responseHandler.handleSuccess(res, result, 'Campaign processed successfully');
  } catch (error) {
    console.error('Error processing campaign:', error);
    return responseHandler.handleError(res, error.message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Process a single lead by lead ID
 */
exports.processLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    
    if (!leadId) {
      return responseHandler.handleError(res, 'Lead ID is required', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const result = await processCampaignService.processLeadById(leadId);
    
    if (!result.success) {
      return responseHandler.handleError(res, result.reason || result.error, HTTP_STATUS_CODES.BAD_REQUEST);
    }

    return responseHandler.handleSuccess(res, result, 'Lead processed successfully');
  } catch (error) {
    console.error('Error processing lead:', error);
    return responseHandler.handleError(res, error.message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Check if campaign is active
 */
exports.checkCampaignStatus = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    if (!campaignId) {
      return responseHandler.handleError(res, 'Campaign ID is required', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const isActive = await processCampaignService.isCampaignActive(campaignId);
    
    return responseHandler.handleSuccess(res, { 
      campaignId, 
      isActive 
    }, 'Campaign status retrieved successfully');
  } catch (error) {
    console.error('Error checking campaign status:', error);
    return responseHandler.handleError(res, error.message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Get active leads for a campaign
 */
exports.getActiveCampaignLeads = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    if (!campaignId) {
      return responseHandler.handleError(res, 'Campaign ID is required', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const leads = await processCampaignService.getActiveCampaignLeads(campaignId);
    
    return responseHandler.handleSuccess(res, {
      campaignId,
      count: leads.length,
      leads
    }, 'Active leads retrieved successfully');
  } catch (error) {
    console.error('Error getting active leads:', error);
    return responseHandler.handleError(res, error.message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};