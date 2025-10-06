const {
  addMechanicsBulkUploadJob,
  addServiceProvidersBulkUploadJob,
  addPoliciesBulkUploadJob,
  getJobStatus,
  getQueueStats,
  cleanupExpiredJobs,
  TTL_CONFIG,
  QUEUE_NAMES
} = require('../services/queue/queueManager');

/**
 * Bulk upload mechanics (using background queue)
 */
exports.bulkUploadMechanicsController = async (req, res) => {
  try {
    const mechanics = Array.isArray(req.body) ? req.body : req.body.mechanics;
    const { adminRole } = req.user || {};
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    if (!Array.isArray(mechanics) || mechanics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty mechanics array'
      });
    }

    const jobData = {
      data: mechanics,
      user: {
        userId,
        email: req.user.email,
        adminRole,
        organizationId,
        organizationRole: req.user.organizationRole
      },
      organizationId,
      adminRole,
      userId,
      requestedAt: new Date(),
      requestMetadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        totalRecords: mechanics.length
      }
    };

    const job = await addMechanicsBulkUploadJob(jobData);

    res.status(202).json({
      success: true,
      message: 'Mechanics bulk upload job queued successfully',
      data: {
        jobId: job.id,
        queueName: QUEUE_NAMES.BULK_UPLOAD_MECHANICS,
        status: 'queued',
        totalRecords: mechanics.length,
        estimatedProcessingTime: `${Math.ceil(mechanics.length / 100)} minutes`,
        statusCheckUrl: `/api/v1/jobs/${QUEUE_NAMES.BULK_UPLOAD_MECHANICS}/${job.id}/status`
      }
    });
  } catch (error) {
    console.error('Error in bulkUploadMechanicsController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue mechanics bulk upload job'
    });
  }
};

/**
 * Bulk upload service providers (using background queue)
 */
exports.bulkUploadServiceProvidersController = async (req, res) => {
  try {
    const serviceProviders = Array.isArray(req.body) ? req.body : req.body.serviceProviders;
    const { adminRole } = req.user || {};
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    if (!Array.isArray(serviceProviders) || serviceProviders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty service providers array'
      });
    }

    const jobData = {
      data: serviceProviders,
      user: {
        userId,
        email: req.user.email,
        adminRole,
        organizationId,
        organizationRole: req.user.organizationRole
      },
      organizationId,
      adminRole,
      userId,
      requestedAt: new Date(),
      requestMetadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        totalRecords: serviceProviders.length
      }
    };

    const job = await addServiceProvidersBulkUploadJob(jobData);

    res.status(202).json({
      success: true,
      message: 'Service providers bulk upload job queued successfully',
      data: {
        jobId: job.id,
        queueName: QUEUE_NAMES.BULK_UPLOAD_SERVICE_PROVIDERS,
        status: 'queued',
        totalRecords: serviceProviders.length,
        estimatedProcessingTime: `${Math.ceil(serviceProviders.length / 50)} minutes`,
        statusCheckUrl: `/api/v1/jobs/${QUEUE_NAMES.BULK_UPLOAD_SERVICE_PROVIDERS}/${job.id}/status`
      }
    });
  } catch (error) {
    console.error('Error in bulkUploadServiceProvidersController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue service providers bulk upload job'
    });
  }
};

/**
 * Bulk upload policies (using background queue)
 */
exports.bulkUploadPoliciesController = async (req, res) => {
  try {
    const policies = Array.isArray(req.body) ? req.body : req.body.policies;
    const { adminRole } = req.user || {};
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    if (!Array.isArray(policies) || policies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty policies array'
      });
    }

    const jobData = {
      data: policies,
      user: {
        userId,
        email: req.user.email,
        adminRole,
        organizationId,
        organizationRole: req.user.organizationRole
      },
      organizationId,
      adminRole,
      userId,
      requestedAt: new Date(),
      requestMetadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        totalRecords: policies.length
      }
    };

    const job = await addPoliciesBulkUploadJob(jobData);

    res.status(202).json({
      success: true,
      message: 'Policies bulk upload job queued successfully',
      data: {
        jobId: job.id,
        queueName: QUEUE_NAMES.BULK_UPLOAD_POLICIES,
        status: 'queued',
        totalRecords: policies.length,
        estimatedProcessingTime: `${Math.ceil(policies.length / 75)} minutes`,
        statusCheckUrl: `/api/v1/jobs/${QUEUE_NAMES.BULK_UPLOAD_POLICIES}/${job.id}/status`
      }
    });
  } catch (error) {
    console.error('Error in bulkUploadPoliciesController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue policies bulk upload job'
    });
  }
};

/**
 * Get job status with TTL information
 */
exports.getJobStatusController = async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const userOrganizationId = req.user.organizationId;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: 'User must belong to an organization'
      });
    }

    // Validate queue name
    const validQueues = Object.values(QUEUE_NAMES);
    if (!validQueues.includes(queueName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid queue name'
      });
    }

    const jobStatus = await getJobStatus(queueName, jobId);

    if (jobStatus.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Security check: ensure user can only see jobs from their organization
    if (jobStatus.data && jobStatus.data.organizationId !== userOrganizationId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Job does not belong to your organization'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        jobId: jobStatus.id,
        status: jobStatus.status,
        progress: jobStatus.progress,
        result: jobStatus.result,
        error: jobStatus.failedReason,
        createdAt: jobStatus.createdAt,
        processedAt: jobStatus.processedOn,
        completedAt: jobStatus.finishedOn,
        queueName,
        metadata: jobStatus.data?.requestMetadata,
        ttl: jobStatus.ttl // Include TTL information
      }
    });
  } catch (error) {
    console.error('Error in getJobStatusController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get job status'
    });
  }
};

/**
 * Get queue statistics with TTL configuration
 */
exports.getQueueStatsController = async (req, res) => {
  try {
    const { queueName } = req.params;
    const userOrganizationId = req.user.organizationId;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: 'User must belong to an organization'
      });
    }

    // Validate queue name
    const validQueues = Object.values(QUEUE_NAMES);
    if (!validQueues.includes(queueName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid queue name'
      });
    }

    const stats = await getQueueStats(queueName);

    res.status(200).json({
      success: true,
      data: {
        queueName,
        statistics: stats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error in getQueueStatsController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue statistics'
    });
  }
};

/**
 * Get all queue statistics with TTL configuration
 */
exports.getAllQueueStatsController = async (req, res) => {
  try {
    const userOrganizationId = req.user.organizationId;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: 'User must belong to an organization'
      });
    }

    const allStats = {};
    
    for (const [key, queueName] of Object.entries(QUEUE_NAMES)) {
      try {
        allStats[queueName] = await getQueueStats(queueName);
      } catch (error) {
        console.error(`Error getting stats for queue ${queueName}:`, error);
        allStats[queueName] = { error: error.message };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        queues: allStats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error in getAllQueueStatsController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get queue statistics'
    });
  }
};

/**
 * Manual cleanup of expired jobs
 */
exports.cleanupExpiredJobsController = async (req, res) => {
  try {
    const userOrganizationId = req.user.organizationId;
    const userRole = req.user.role || req.user.adminRole;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: 'User must belong to an organization'
      });
    }

    // Only allow admin roles to trigger manual cleanup
    const adminRoles = ['admin', 'super_admin', 'sub_admin'];
    if (!adminRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Admin role required for manual cleanup'
      });
    }

    console.log(`🧹 Manual cleanup triggered by user ${req.user.userId} from organization ${userOrganizationId}`);
    
    const cleanedCount = await cleanupExpiredJobs();

    res.status(200).json({
      success: true,
      message: 'Manual cleanup completed successfully',
      data: {
        cleanedJobs: cleanedCount,
        triggeredBy: req.user.userId,
        triggeredAt: new Date(),
        ttlConfig: {
          jobDataTtlDays: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60 * 60 * 24),
          completedJobCleanupMinutes: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY / (1000 * 60),
          failedJobTtlDays: TTL_CONFIG.FAILED_JOB_TTL / (1000 * 60 * 60 * 24)
        }
      }
    });
  } catch (error) {
    console.error('Error in cleanupExpiredJobsController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup expired jobs'
    });
  }
};

/**
 * Get TTL configuration and status
 */
exports.getTTLConfigController = async (req, res) => {
  try {
    const userOrganizationId = req.user.organizationId;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: 'User must belong to an organization'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ttlConfiguration: {
          jobDataTtl: {
            milliseconds: TTL_CONFIG.JOB_DATA_TTL,
            seconds: TTL_CONFIG.JOB_DATA_TTL / 1000,
            minutes: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60),
            hours: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60 * 60),
            days: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60 * 60 * 24)
          },
          completedJobCleanup: {
            milliseconds: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY,
            seconds: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY / 1000,
            minutes: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY / (1000 * 60)
          },
          failedJobTtl: {
            milliseconds: TTL_CONFIG.FAILED_JOB_TTL,
            seconds: TTL_CONFIG.FAILED_JOB_TTL / 1000,
            minutes: TTL_CONFIG.FAILED_JOB_TTL / (1000 * 60),
            hours: TTL_CONFIG.FAILED_JOB_TTL / (1000 * 60 * 60),
            days: TTL_CONFIG.FAILED_JOB_TTL / (1000 * 60 * 60 * 24)
          }
        },
        features: {
          automaticCleanup: true,
          periodicCleanup: true,
          manualCleanup: true,
          ttlTracking: true
        },
        description: {
          jobDataTtl: 'Jobs are automatically removed after 3 days',
          completedJobCleanup: 'Completed jobs are cleaned up 1 minute after completion',
          failedJobCleanup: 'Failed jobs are cleaned up 5 minutes after failure',
          periodicCleanup: 'Automatic cleanup runs every hour to remove expired jobs'
        }
      }
    });
  } catch (error) {
    console.error('Error in getTTLConfigController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get TTL configuration'
    });
  }
}; 