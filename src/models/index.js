const BaseModel = require("./base.model");
const mongoose = require("mongoose");
const { getOrCreateModel } = require("./model.utils");

// Import all models
const Document = require("./document.model");
const AIActivity = require("./ai-activity.model");
const AICallActivity = require("./ai-call-activity.model");
const Organization = require("./organization.model");
const Agent = require("./agent.model");
const Mechanic = require("./mechanic.model");
const Policy = require("./policy.model");
const Role = require("./role.model");
const ServiceProvider = require("./service-provider.model");
const Ticket = require("./ticket.model");
const User = require("./user.model");
const AIConfig = require("./ai-config.model");
const Onboarding = require("./onboarding.model");
const Driver = require("./driver.model");
const DriverVerification = require("./driver-verification.model");
const DriverPortalSettings = require("./driver-portal-settings.model");
const Terms = require("./ticketsTerms.model");
const SystemStatus = require("./systemStatus.model");
const Payment = require("./payment.model");
const Request = require("./request.model");
// const UserSubcontractor = require('./user-subcontractor.model');
// const TokenVerification = require('./token-verification.model');
// const Team = require('./team.model');
const Task = require("./task.model");
const Widget = require("./widget.model");
const OrganizationWidget = require("./organization-widget.model");
const { ChatThread, ChatMessage, VectorStoreEntry } = require("./chat");
// const Fleet = require('./fleet.model');
const Client = require("./client.model");
const Tracking = require("./tracking.model");
const VehicleClassification = require("./vehicle-classification.model");
const MechanicDetails = require("./mechanic-details.model");
const KbItems = require("./kbItems.model");

// Import schemas for remaining models
// const policiesDocUploadStatusSchema = require('../../db-models/mongo/schemas/policies-doc-upload-status');
// const mechanicDocUploadStatusSchema = require('../../db-models/mongo/schemas/mechanicDocUploadStatus');
// const loggingsSchema = require('../../db-models/mongo/schemas/loggings');
// const fleetDocUploadStatusSchema = require('../../db-models/mongo/schemas/fleet-doc-upload-status');
// const dnuListSchema = require('../../db-models/mongo/schemas/dnuList');
// const dnuCsvUploadStatusSchema = require('../../db-models/mongo/schemas/dnuCsvUploadStatus');

// Export models and utilities
module.exports = {
  getOrCreateModel,
  BaseModel,
  // Add other utility functions here if needed
  // Models with their own files
  Document,
  AIActivity,
  AICallActivity,
  Organization,
  Agent,
  Driver,
  DriverVerification,
  DriverPortalSettings,
  Mechanic,
  Policy,
  Role,
  ServiceProvider,
  Ticket,
  User,
  AIConfig,
  Onboarding,
  SystemStatus,
  Payment,
  Request,
  Widget,
  OrganizationWidget,
  ChatThread,
  ChatMessage,
  VectorStoreEntry,
  // UserSubcontractor,
  // TokenVerification,
  // Team,
  // Fleet,
  Client,
  Tracking,
  Terms,
  Task,
  VehicleClassification,
  MechanicDetails,
  KbItems,
  // // Models created on the fly (these should be migrated to their own files in the future)
  // PolicyDocUploadStatus: getOrCreateModel('PolicyDocUploadStatus', policiesDocUploadStatusSchema),
  // MechanicDocUploadStatus: getOrCreateModel('MechanicDocUploadStatus', mechanicDocUploadStatusSchema),
  // Logging: getOrCreateModel('Logging', loggingsSchema),
  // FleetDocUploadStatus: getOrCreateModel('FleetDocUploadStatus', fleetDocUploadStatusSchema),
  // DnuList: getOrCreateModel('DnuList', dnuListSchema),
  // DnuCsvUploadStatus: getOrCreateModel('DnuCsvUploadStatus', dnuCsvUploadStatusSchema)
};
