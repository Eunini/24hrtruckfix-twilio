const Bull = require("bull");
const redisClient = require("./redisClient");
const chunk = require("lodash.chunk");

// Queue names
const QUEUE_NAMES = {
  BULK_UPLOAD_MECHANICS: "bulk-upload-mechanics",
  BULK_UPLOAD_SERVICE_PROVIDERS: "bulk-upload-service-providers",
  BULK_UPLOAD_POLICIES: "bulk-upload-policies",
  CHAT_SESSION_TIMEOUT: "chat-session-timeout",
};

// TTL Configuration (in milliseconds)
const TTL_CONFIG = {
  JOB_DATA_TTL: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
  COMPLETED_JOB_CLEANUP_DELAY: 60 * 1000, // 1 minute in milliseconds
  FAILED_JOB_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days for failed jobs
};

// Helper function to parse Redis DB value (same as in redisClient.js)
const parseRedisDB = (dbValue) => {
  if (dbValue === undefined || dbValue === null || dbValue === "") {
    return 0; // Default to database 0
  }

  if (typeof dbValue === "number") {
    return dbValue;
  }

  if (typeof dbValue === "string") {
    if (dbValue.toLowerCase() === "default") {
      return 0;
    }

    const parsed = parseInt(dbValue, 10);
    if (isNaN(parsed)) {
      console.warn(
        `⚠️ Invalid REDIS_DB value: "${dbValue}". Using default database 0.`
      );
      return 0;
    }

    if (parsed < 0 || parsed > 15) {
      console.warn(
        `⚠️ REDIS_DB value ${parsed} is out of range (0-15). Using database 0.`
      );
      return 0;
    }

    return parsed;
  }

  console.warn(
    `⚠️ Unexpected REDIS_DB type: ${typeof dbValue}. Using default database 0.`
  );
  return 0;
};

// Redis connection options for Bull
const redisOptions = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseRedisDB(process.env.REDIS_DB),
  },
  settings: {
    stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 1, // Max number of times a job can be stalled
  },
};

console.log("🔧 Bull Queue Redis Configuration:", {
  host: redisOptions.redis.host,
  port: redisOptions.redis.port,
  db: redisOptions.redis.db,
  hasPassword: !!redisOptions.redis.password,
});

// Create queues
const mechanicsQueue = new Bull(
  QUEUE_NAMES.BULK_UPLOAD_MECHANICS,
  redisOptions
);
const serviceProvidersQueue = new Bull(
  QUEUE_NAMES.BULK_UPLOAD_SERVICE_PROVIDERS,
  redisOptions
);
const policiesQueue = new Bull(QUEUE_NAMES.BULK_UPLOAD_POLICIES, redisOptions);
const chatSessionTimeoutQueue = new Bull(
  QUEUE_NAMES.CHAT_SESSION_TIMEOUT,
  redisOptions
);

// Queue configurations with TTL
const defaultJobOptions = {
  removeOnComplete: false, // Don't auto-remove, we'll handle TTL manually
  removeOnFail: false, // Don't auto-remove failed jobs, we'll handle TTL manually
  attempts: 3, // Retry failed jobs 3 times
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  // Job TTL - jobs will be automatically removed after 3 days
  ttl: TTL_CONFIG.JOB_DATA_TTL,
  // Job timeout - if a job takes longer than 30 minutes, consider it failed
  timeout: 30 * 60 * 1000, // 30 minutes
};

// Job cleanup service
const scheduleJobCleanup = async (
  job,
  delay = TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY
) => {
  try {
    setTimeout(async () => {
      try {
        const currentJob = await job.queue.getJob(job.id);
        if (currentJob) {
          const state = await currentJob.getState();
          if (state === "completed" || state === "failed") {
            console.log(
              `🗑️ Cleaning up ${state} job ${job.id} after ${
                delay / 1000
              } seconds`
            );
            await currentJob.remove();
            console.log(`✅ Job ${job.id} cleaned up successfully`);
          }
        }
      } catch (error) {
        console.error(`❌ Error cleaning up job ${job.id}:`, error.message);
      }
    }, delay);
  } catch (error) {
    console.error(
      `❌ Error scheduling cleanup for job ${job.id}:`,
      error.message
    );
  }
};

// Enhanced job options with TTL
const getJobOptionsWithTTL = (customOptions = {}) => {
  return {
    ...defaultJobOptions,
    ...customOptions,
    // Add job creation timestamp for TTL tracking
    jobId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
};

// Add job to mechanics queue
const addMechanicsBulkUploadJob = async (jobData) => {
  try {
    const jobOptions = {
      ...getJobOptionsWithTTL({ delay: 1000 }),
      connection: redisClient,
    };
    const batches = chunk(jobData.mechanics, 500);
    const jobs = [];
    for (const batch of batches) {
      const job = await mechanicsQueue.add(
        "bulk-upload-mechanics",
        {
          ...jobData,
          mechanics: batch,
          createdAt: new Date().toISOString(),
          ttl: TTL_CONFIG.JOB_DATA_TTL,
        },
        jobOptions
      );

      console.log(
        `✅ Mechanics bulk upload job added: ${job.id} (TTL: ${
          TTL_CONFIG.JOB_DATA_TTL / 1000 / 60 / 60 / 24
        } days)`
      );
      jobs.push(job);
    }

    return jobs;
  } catch (error) {
    console.error("❌ Error adding mechanics bulk upload job:", error);
    throw error;
  }
};

// Add job to service providers queue
const addServiceProvidersBulkUploadJob = async (jobData) => {
  try {
    const jobOptions = getJobOptionsWithTTL({ delay: 1000 });
    const job = await serviceProvidersQueue.add(
      "bulk-upload-service-providers",
      {
        ...jobData,
        createdAt: new Date().toISOString(),
        ttl: TTL_CONFIG.JOB_DATA_TTL,
      },
      jobOptions
    );

    console.log(
      `✅ Service providers bulk upload job added: ${job.id} (TTL: ${
        TTL_CONFIG.JOB_DATA_TTL / 1000 / 60 / 60 / 24
      } days)`
    );
    return job;
  } catch (error) {
    console.error("❌ Error adding service providers bulk upload job:", error);
    throw error;
  }
};

// Add job to policies queue
const addPoliciesBulkUploadJob = async (jobData) => {
  try {
    const jobOptions = getJobOptionsWithTTL({ delay: 1000 });
    const job = await policiesQueue.add(
      "bulk-upload-policies",
      {
        ...jobData,
        createdAt: new Date().toISOString(),
        ttl: TTL_CONFIG.JOB_DATA_TTL,
      },
      jobOptions
    );

    console.log(
      `✅ Policies bulk upload job added: ${job.id} (TTL: ${
        TTL_CONFIG.JOB_DATA_TTL / 1000 / 60 / 60 / 24
      } days)`
    );
    return job;
  } catch (error) {
    console.error("❌ Error adding policies bulk upload job:", error);
    throw error;
  }
};

// Add job to chat session timeout queue
const addChatSessionTimeoutJob = async (
  threadId,
  mechanicId,
  organizationId
) => {
  try {
    const jobOptions = {
      delay: 10 * 60 * 1000, // 10 minutes delay
      removeOnComplete: true, // Auto-remove completed jobs
      removeOnFail: true, // Auto-remove failed jobs
      attempts: 1, // Don't retry timeout jobs
      jobId: `chat-timeout-${threadId}`, // Use threadId as job ID for uniqueness
    };

    const job = await chatSessionTimeoutQueue.add(
      "chat-session-timeout",
      {
        threadId,
        mechanicId,
        organizationId,
        createdAt: new Date().toISOString(),
      },
      jobOptions
    );

    console.log(
      `✅ Chat session timeout job added: ${job.id} for thread ${threadId} (delay: 10 minutes)`
    );
    return job;
  } catch (error) {
    console.error("❌ Error adding chat session timeout job:", error);
    throw error;
  }
};

// Update chat session timeout job (reschedule)
const updateChatSessionTimeoutJob = async (threadId) => {
  try {
    const jobId = `chat-timeout-${threadId}`;

    // Try to get the existing job
    const existingJob = await chatSessionTimeoutQueue.getJob(jobId);

    if (existingJob) {
      // Remove the existing job
      await existingJob.remove();
      console.log(`🔄 Removed existing timeout job for thread ${threadId}`);
    }

    // Create a new job with fresh 10-minute delay
    const jobOptions = {
      delay: 10 * 60 * 1000, // 10 minutes delay
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 1,
      jobId: jobId,
    };

    const job = await chatSessionTimeoutQueue.add(
      "chat-session-timeout",
      {
        threadId,
        createdAt: new Date().toISOString(),
      },
      jobOptions
    );

    console.log(
      `✅ Updated chat session timeout job: ${job.id} for thread ${threadId} (new delay: 10 minutes)`
    );
    return job;
  } catch (error) {
    console.error("❌ Error updating chat session timeout job:", error);
    throw error;
  }
};

// Cancel chat session timeout job
const cancelChatSessionTimeoutJob = async (threadId) => {
  try {
    const jobId = `chat-timeout-${threadId}`;
    const existingJob = await chatSessionTimeoutQueue.getJob(jobId);

    if (existingJob) {
      await existingJob.remove();
      console.log(`🚫 Cancelled timeout job for thread ${threadId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error cancelling chat session timeout job:", error);
    throw error;
  }
};

// Get job status with TTL information
const getJobStatus = async (queueName, jobId) => {
  try {
    let queue;
    switch (queueName) {
      case QUEUE_NAMES.BULK_UPLOAD_MECHANICS:
        queue = mechanicsQueue;
        break;
      case QUEUE_NAMES.BULK_UPLOAD_SERVICE_PROVIDERS:
        queue = serviceProvidersQueue;
        break;
      case QUEUE_NAMES.BULK_UPLOAD_POLICIES:
        queue = policiesQueue;
        break;
      case QUEUE_NAMES.CHAT_SESSION_TIMEOUT:
        queue = chatSessionTimeoutQueue;
        break;
      default:
        throw new Error("Invalid queue name");
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return { status: "not_found" };
    }

    const state = await job.getState();
    const progress = job.progress();

    // Calculate TTL information
    const createdAt = new Date(job.timestamp);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const ttlRemainingMs = TTL_CONFIG.JOB_DATA_TTL - ageMs;
    const ttlRemainingHours = Math.max(
      0,
      Math.floor(ttlRemainingMs / (1000 * 60 * 60))
    );

    return {
      id: job.id,
      status: state,
      progress: progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      createdAt,
      ttl: {
        totalHours: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60 * 60),
        remainingHours: ttlRemainingHours,
        expiresAt: new Date(createdAt.getTime() + TTL_CONFIG.JOB_DATA_TTL),
        isExpired: ttlRemainingMs <= 0,
      },
    };
  } catch (error) {
    console.error("❌ Error getting job status:", error);
    throw error;
  }
};

// Get queue statistics
const getQueueStats = async (queueName) => {
  try {
    let queue;
    switch (queueName) {
      case QUEUE_NAMES.BULK_UPLOAD_MECHANICS:
        queue = mechanicsQueue;
        break;
      case QUEUE_NAMES.BULK_UPLOAD_SERVICE_PROVIDERS:
        queue = serviceProvidersQueue;
        break;
      case QUEUE_NAMES.BULK_UPLOAD_POLICIES:
        queue = policiesQueue;
        break;
      case QUEUE_NAMES.CHAT_SESSION_TIMEOUT:
        queue = chatSessionTimeoutQueue;
        break;
      default:
        throw new Error("Invalid queue name");
    }

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
      ttlConfig: {
        jobDataTtlDays: TTL_CONFIG.JOB_DATA_TTL / (1000 * 60 * 60 * 24),
        completedJobCleanupMinutes:
          TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY / (1000 * 60),
        failedJobTtlDays: TTL_CONFIG.FAILED_JOB_TTL / (1000 * 60 * 60 * 24),
      },
    };
  } catch (error) {
    console.error("❌ Error getting queue stats:", error);
    throw error;
  }
};

// Cleanup expired jobs manually (can be called periodically)
const cleanupExpiredJobs = async () => {
  const queues = [
    mechanicsQueue,
    serviceProvidersQueue,
    policiesQueue,
    chatSessionTimeoutQueue,
  ];
  let totalCleaned = 0;

  for (const queue of queues) {
    try {
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const allJobs = [...completed, ...failed];

      for (const job of allJobs) {
        const createdAt = new Date(job.timestamp);
        const now = new Date();
        const ageMs = now.getTime() - createdAt.getTime();

        // Clean up jobs older than TTL
        if (ageMs > TTL_CONFIG.JOB_DATA_TTL) {
          await job.remove();
          totalCleaned++;
          console.log(
            `🗑️ Cleaned up expired job ${job.id} (age: ${Math.floor(
              ageMs / 1000 / 60 / 60
            )} hours)`
          );
        }
      }
    } catch (error) {
      console.error(
        `❌ Error cleaning up expired jobs for queue ${queue.name}:`,
        error.message
      );
    }
  }

  if (totalCleaned > 0) {
    console.log(`✅ Cleaned up ${totalCleaned} expired jobs`);
  }

  return totalCleaned;
};

// Start periodic cleanup (run every hour)
const startPeriodicCleanup = () => {
  const cleanupInterval = 60 * 60 * 1000; // 1 hour

  setInterval(async () => {
    console.log("🧹 Running periodic job cleanup...");
    await cleanupExpiredJobs();
  }, cleanupInterval);

  console.log(
    `🕐 Periodic cleanup started (every ${cleanupInterval / 1000 / 60} minutes)`
  );
};

module.exports = {
  QUEUE_NAMES,
  TTL_CONFIG,
  mechanicsQueue,
  serviceProvidersQueue,
  policiesQueue,
  chatSessionTimeoutQueue,
  addMechanicsBulkUploadJob,
  addServiceProvidersBulkUploadJob,
  addPoliciesBulkUploadJob,
  addChatSessionTimeoutJob,
  updateChatSessionTimeoutJob,
  cancelChatSessionTimeoutJob,
  getJobStatus,
  getQueueStats,
  scheduleJobCleanup,
  cleanupExpiredJobs,
  startPeriodicCleanup,
};
