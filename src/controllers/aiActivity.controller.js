'use strict';
const { nanoid } = require('nanoid');
const { notifyService, sendDriverSmsService, emitProgressService } = require('../services/ai/notification');
const { HTTP_STATUS_CODES, headerBody } = require('../helper');
const AiProgress = require('../models/AiProgress.model');
const Organization = require('../models/organization.model');
const Ticket = require('../models/ticket.model');
const SystemStatus = require('../models/systemStatus.model');
const AiConfig = require('../models/ai-config.model');
const UrlForDriver = require('../models/urlForDriver.model');
const Onboarding = require('../models/onboarding.model');
const { outboundService } = require('../services/ai/outbound');

const clientPhone = process.env.PHONE;
const clientEmail = process.env.TO_EMAIL;
const STATUS_ID = process.env.MONGODB_STATUS_ID;

// Get all ticket logs
exports.getTicketLogs = async function (req, res) {
  try {
    const logs = await AiProgress.find()
      .sort({ createdAt: -1 })
      .lean();

    const result = logs.map(doc => ({
      ticketId: doc.ticketId.toString(),
      details: doc.details || []
    }));

    res
      .set(headerBody)
      .status(HTTP_STATUS_CODES.OK)
      .json(result);
  } catch (error) {
    console.error('getTicketLogs error:', error);
    res
      .set(headerBody)
      .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({
        message: 'Error fetching progress entries',
        error: error.message
      });
  }
};

// Example of using emitProgressService in a controller function
exports.handleDriverLocation = async (req, res) => {
  const { ticketId, location } = req.body;

    try {
    // Process the location
    await emitProgressService({
      ticketId,
      step: 'locationAscertained',
      status: 'success',
      metadata: { location }
    });

    // Send notifications
    await notifyService({
        ticketId,
      functionKey: 'locationAscertained',
        status: 'success',
      params: { ticketId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('handleDriverLocation error:', error);
    if (ticketId) {
      await emitProgressService({
        ticketId,
        step: 'locationAscertained',
        status: 'error',
        metadata: { error: error.message }
      });
    }
    res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Express route handler for outbound processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.outboundFunction = async function (req, res) {
  try {
    // Extract ticket ID from request body
    const ticketId = req.body.id || req.body.fullDocument?.id;
    
    // Call the service function
    const result = await outboundService(ticketId);
    
    // Return success response
    return res.json(result);
  } catch (error) {
    // Return error response with appropriate status code
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message: error.message,
        code: error.code || 'OUTBOUND_ERROR'
      });
  }
};

exports.shortUrlHandler = async function (req, res) {
    const linkId = req.params.link_id;
  
    if (!linkId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing link_id in path parameters", code: "NO_LINK_ID" });
    }
  
    try {
      // SYSTEM CHECK
    const sys = await SystemStatus.findById(STATUS_ID);
      if (!sys?.active) {
        return res
          .status(403)
          .json({ success: false, message: "System is currently inactive or not found", code: "SYS_INACTIVE" });
      }
  
      // LOOKUP short URL record
    const urlDoc = await UrlForDriver.findOne({ link_id: linkId });
      if (!urlDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Short URL does not exist", code: "NO_URL" });
      }
  
      // FETCH ticket
    const ticketDoc = await Ticket.findById(urlDoc.ticket_id);
      if (!ticketDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Ticket not found", code: "TICKET_NOT_FOUND" });
      }
  
      // FETCH client
    const clientDoc = await Organization.findById(ticketDoc.organization_id);
      if (!clientDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Organization not found", code: "ORGANIZATION_NOT_FOUND" });
      }
  
      // FETCH AI config
    const configDoc = await AiConfig.findOne({ client_id: ticketDoc.organization_id.toString() });
      if (!configDoc) {
        return res
          .status(404)
          .json({ success: false, message: "No AI config found", code: "NO_AI_CONFIG" });
      }
  
      // FETCH onboarding details
    const onboardDoc = await Onboarding.findOne({ user_id: ticketDoc.organization_id });
      const companyDetails = onboardDoc?.companyDetails || {};
  
      // BUILD REDIRECT URL
      const baseLink = urlDoc.link;
      const params = new URLSearchParams({
      website: companyDetails.companyWebsite || "24hrtruckservices.com",
      cli_email: clientDoc.email || "concierge@24hrtruckfix.com",
      cli_name: companyDetails.companyName || "24Hr Truck Services",
      cli_address1: companyDetails.officialAddress || "300 Delaware Ave. Suite 100",
      cli_address2: companyDetails.incorporatedIn || "Wilmington DE 19801",
      cli_phone: (configDoc.number || "")
                         .replace("+", "")
                         .replace(/(\d{4})(\d{3})(\d{4})/, "$1-$2-$3")
      });
  
      const finalUrl = `${baseLink}&${params.toString()}`;
  
      // Redirect client
      return res.redirect(302, finalUrl);
  
    } catch (error) {
      console.error("❌ shortUrlHandler error:", error);
      return res
        .status(error.statusCode || 500)
        .json({
          success: false,
          message: error.message,
        code: error.code || 'URL_ERROR'
      });
  }
};
