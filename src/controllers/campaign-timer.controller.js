const campaignTimerService = require("../services/campaign-timer.service");
const HTTP_STATUS_CODES = require("../../constants/http.status-codes");
const responseHandler = require("../utils/response.handler");

/**
 * Process all active campaigns with timer logic
 * @route POST /api/v1/campaign-timer/process
 */
exports.processActiveCampaigns = async (req, res) => {
  try {
    console.log(`🔄 [${new Date().toISOString()}] Campaign timer processing requested`);
    
    const result = await campaignTimerService.processActiveCampaignsWithTimer();
    
    if (!result.success) {
      return responseHandler.handleError(
        res,
        result.message || "Campaign timer processing failed",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    return responseHandler.handleSuccess(
      res,
      result,
      "Campaign timer processing completed successfully"
    );

  } catch (error) {
    console.error("❌ Error in campaign timer processing:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Process a specific campaign with timer logic
 * @route POST /api/v1/campaign-timer/process/:campaignId
 */
exports.processCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
      
      if (!campaignId) {
        return responseHandler.handleError(
          res,
          "Campaign ID is required",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }

      console.log(`🎯 Processing specific campaign with timer: ${campaignId}`);
      
      const result = await campaignTimerService.processCampaignWithTimer(campaignId);
      
      if (!result.success) {
        return responseHandler.handleError(
          res,
          result.reason || result.error,
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }

      return responseHandler.handleSuccess(
        res,
        result,
        "Campaign processed successfully with timer logic"
      );

    } catch (error) {
      console.error("❌ Error processing campaign with timer:", error);
      return responseHandler.handleError(
        res,
        error.message,
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }
};

/**
 * Get campaign timer statistics
 * @route GET /api/v1/campaign-timer/stats
 */
exports.getTimerStats = async (req, res) => {
  try {
    const stats = await campaignTimerService.getTimerStats();
    
    return responseHandler.handleSuccess(
      res,
      stats,
      "Campaign timer statistics retrieved successfully"
    );

  } catch (error) {
    console.error("❌ Error getting campaign timer stats:", error);
    return responseHandler.handleError(
      res,
      error.message,
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Health check for campaign timer service
 * @route GET /api/v1/campaign-timer/health
 */
exports.healthCheck = async (req, res) => {
  try {
    const stats = await campaignTimerService.getTimerStats();
    
    return responseHandler.handleSuccess(
      res,
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "Campaign Timer Service",
        stats,
        endpoints: {
          process: "POST /api/v1/campaign-timer/process",
          processCampaign: "POST /api/v1/campaign-timer/process/:campaignId",
          stats: "GET /api/v1/campaign-timer/stats",
          health: "GET /api/v1/campaign-timer/health"
        }
      },
      "Campaign timer service is healthy"
    );

  } catch (error) {
    console.error("❌ Campaign timer health check error:", error);
    return responseHandler.handleError(
      res,
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        service: "Campaign Timer Service",
        error: error.message
      },
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
};