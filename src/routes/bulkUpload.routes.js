const express = require('express');
const router = express.Router();

const {
  bulkUploadMechanicsController,
  bulkUploadServiceProvidersController,
  bulkUploadPoliciesController,
  getJobStatusController,
  getQueueStatsController,
  getAllQueueStatsController,
  cleanupExpiredJobsController,
  getTTLConfigController
} = require('../controllers/bulkUpload.controller');

// Authentication middleware
const { authenticate, requireOrganization } = require('../middleware/auth');

// Base path: /api/v1

// Bulk upload routes
router.post('/bulk-upload/mechanics', authenticate, requireOrganization, bulkUploadMechanicsController);
router.post('/bulk-upload/service-providers', authenticate, requireOrganization, bulkUploadServiceProvidersController);
router.post('/bulk-upload/policies', authenticate, requireOrganization, bulkUploadPoliciesController);

// Job monitoring routes
router.get('/jobs/:queueName/:jobId/status', authenticate, requireOrganization, getJobStatusController);
router.get('/queues/:queueName/stats', authenticate, requireOrganization, getQueueStatsController);
router.get('/queues/stats', authenticate, requireOrganization, getAllQueueStatsController);

// TTL management routes
router.post('/jobs/cleanup', authenticate, requireOrganization, cleanupExpiredJobsController);
router.get('/jobs/ttl/config', authenticate, requireOrganization, getTTLConfigController);

module.exports = router; 