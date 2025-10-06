const express = require('express');
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const campaignsController = require('../controllers/campaigns.controller');

// Apply authorization middleware
router.use(authenticate);

// CAMPAIGN ROUTES

// Create a new campaign
router.post('/campaigns', campaignsController.createCampaign);

// Get all campaigns for an organization
router.get('/campaigns/organization/:organizationId', campaignsController.getAllCampaigns);

// Get campaign by ID
router.get('/campaigns/:campaignId', campaignsController.getCampaignById);

// Update campaign
router.put('/campaigns/:campaignId', campaignsController.updateCampaign);

// Delete campaign
router.delete('/campaigns/:campaignId', campaignsController.deleteCampaign);

// Add messages to campaign in bulk
router.post('/campaigns/:campaignId/messages', campaignsController.addMessagesToCampaign);

// Activate campaign
router.post('/campaigns/:campaignId/activate', campaignsController.activateCampaign);

// Deactivate campaign
router.post('/campaigns/:campaignId/deactivate', campaignsController.deactivateCampaign);

// Get campaign statistics
router.get('/campaigns/:campaignId/stats', campaignsController.getCampaignStats);

// CAMPAIGN LEADS ROUTES

// Add single lead to campaign
router.post('/campaigns/:campaignId/leads', campaignsController.addLeadToCampaign);

// Add multiple leads to campaign (bulk insert)
router.post('/campaigns/:campaignId/leads/bulk', campaignsController.addLeadsToCampaign);

// Get all leads for a campaign
router.get('/campaigns/:campaignId/leads', campaignsController.getCampaignLeads);

// Update campaign lead
router.put('/campaigns/leads/:leadId', campaignsController.updateCampaignLead);

// Delete campaign lead
router.delete('/campaigns/leads/:leadId', campaignsController.deleteCampaignLead);

// MESSAGING SEQUENCE ROUTES

// Create messaging sequence
router.post('/campaigns/messaging-sequences', campaignsController.createMessagingSequence);

// Get messaging sequences for a campaign
router.get('/campaigns/:campaignId/messaging-sequences', campaignsController.getMessagingSequences);

// Update messaging sequence
router.put('/campaigns/messaging-sequences/:sequenceId', campaignsController.updateMessagingSequence);

module.exports = router;