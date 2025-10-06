# TTL (Time To Live) Implementation for Bulk Upload System

## Overview

The bulk upload system now includes comprehensive TTL functionality to automatically manage job lifecycle and prevent Redis memory bloat. This implementation provides automatic cleanup of completed jobs while maintaining data availability for a reasonable period.

## TTL Configuration

### Default Settings

```javascript
const TTL_CONFIG = {
  JOB_DATA_TTL: 3 * 24 * 60 * 60 * 1000,        // 3 days in milliseconds
  COMPLETED_JOB_CLEANUP_DELAY: 60 * 1000,        // 1 minute in milliseconds
  FAILED_JOB_TTL: 7 * 24 * 60 * 60 * 1000,      // 7 days for failed jobs
};
```

### TTL Behavior

| Job State | TTL Behavior | Cleanup Time |
|-----------|--------------|--------------|
| **Completed** | Cleaned up after completion | 1 minute |
| **Failed** | Cleaned up after failure | 5 minutes |
| **All Jobs** | Hard TTL limit | 3 days |
| **Periodic** | Automatic cleanup | Every hour |

## Implementation Details

### 1. Queue Configuration

```javascript
// Enhanced job options with TTL
const defaultJobOptions = {
  removeOnComplete: false,  // Manual TTL management
  removeOnFail: false,      // Manual TTL management
  attempts: 3,
  ttl: TTL_CONFIG.JOB_DATA_TTL,
  timeout: 30 * 60 * 1000,  // 30 minutes
};
```

### 2. Job Creation with TTL

```javascript
const job = await queue.add('job-type', {
  ...jobData,
  createdAt: new Date().toISOString(),
  ttl: TTL_CONFIG.JOB_DATA_TTL,
}, jobOptions);
```

### 3. Automatic Cleanup Service

```javascript
const scheduleJobCleanup = async (job, delay = TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY) => {
  setTimeout(async () => {
    const currentJob = await job.queue.getJob(job.id);
    if (currentJob) {
      const state = await currentJob.getState();
      if (state === 'completed' || state === 'failed') {
        await currentJob.remove();
      }
    }
  }, delay);
};
```

### 4. Periodic Cleanup

```javascript
// Runs every hour to clean up expired jobs
const startPeriodicCleanup = () => {
  setInterval(async () => {
    await cleanupExpiredJobs();
  }, 60 * 60 * 1000); // 1 hour
};
```

## API Endpoints

### TTL Management Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| `GET` | `/api/v1/jobs/ttl/config` | Get TTL configuration | All users |
| `POST` | `/api/v1/jobs/cleanup` | Manual cleanup | Admin only |
| `GET` | `/api/v1/jobs/{queueName}/{jobId}/status` | Job status with TTL | All users |
| `GET` | `/api/v1/queues/stats` | Queue stats with TTL config | All users |

### TTL Information in Responses

#### Job Status Response
```json
{
  "success": true,
  "data": {
    "jobId": "123",
    "status": "completed",
    "progress": 100,
    "ttl": {
      "totalHours": 72,
      "remainingHours": 71,
      "expiresAt": "2024-01-04T10:00:00.000Z",
      "isExpired": false
    }
  }
}
```

#### TTL Configuration Response
```json
{
  "success": true,
  "data": {
    "ttlConfiguration": {
      "jobDataTtl": {
        "days": 3,
        "hours": 72,
        "milliseconds": 259200000
      },
      "completedJobCleanup": {
        "minutes": 1,
        "milliseconds": 60000
      },
      "failedJobTtl": {
        "days": 7,
        "hours": 168,
        "milliseconds": 604800000
      }
    },
    "features": {
      "automaticCleanup": true,
      "periodicCleanup": true,
      "manualCleanup": true,
      "ttlTracking": true
    },
    "description": {
      "jobDataTtl": "Jobs are automatically removed after 3 days",
      "completedJobCleanup": "Completed jobs are cleaned up 1 minute after completion",
      "failedJobCleanup": "Failed jobs are cleaned up 5 minutes after failure",
      "periodicCleanup": "Automatic cleanup runs every hour to remove expired jobs"
    }
  }
}
```

## Worker Integration

### Job Processing with Cleanup

```javascript
// In worker process
mechanicsQueue.process('bulk-upload-mechanics', async (job) => {
  try {
    // Process the job
    const result = await bulkUploadMechanics(data, adminRole, userId, organizationId);
    
    // Schedule cleanup after completion
    await scheduleJobCleanup(job);
    
    return {
      success: true,
      uploaded: result.count,
      cleanupScheduled: true,
      cleanupDelay: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY
    };
  } catch (error) {
    // Schedule cleanup for failed jobs (longer delay)
    await scheduleJobCleanup(job, TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5);
    throw error;
  }
});
```

### Enhanced Event Handling

```javascript
queue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  console.log(`🕐 Job will be cleaned up in ${TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY/1000} seconds`);
});

queue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
  console.log(`🕐 Failed job will be cleaned up in ${(TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5)/1000} seconds`);
});

queue.on('removed', (job) => {
  console.log(`🗑️ Job ${job.id} removed (TTL cleanup)`);
});
```

## Security Considerations

### Access Control

1. **Manual Cleanup**: Only admin roles can trigger manual cleanup
2. **Organization Isolation**: Users can only see jobs from their organization
3. **TTL Configuration**: Read-only for all users, no modification allowed

### Admin Role Check

```javascript
const adminRoles = ['admin', 'super_admin', 'sub_admin'];
if (!adminRoles.includes(userRole)) {
  return res.status(403).json({
    success: false,
    error: 'Access denied: Admin role required for manual cleanup'
  });
}
```

## Monitoring and Logging

### TTL Events Logging

```javascript
// Job creation
console.log(`✅ Job added: ${job.id} (TTL: ${TTL_CONFIG.JOB_DATA_TTL/1000/60/60/24} days)`);

// Cleanup events
console.log(`🗑️ Cleaning up ${state} job ${job.id} after ${delay/1000} seconds`);
console.log(`✅ Job ${job.id} cleaned up successfully`);

// Periodic cleanup
console.log(`🧹 Running periodic job cleanup...`);
console.log(`✅ Cleaned up ${totalCleaned} expired jobs`);
```

### Worker Startup Information

```javascript
console.log('⏰ TTL Configuration:');
console.log(`   📅 Job data TTL: ${TTL_CONFIG.JOB_DATA_TTL/1000/60/60/24} days`);
console.log(`   🧹 Completed job cleanup: ${TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY/1000} seconds`);
console.log(`   ❌ Failed job cleanup: ${(TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5)/1000} seconds`);
```

## Testing

### TTL Test Script

The system includes a comprehensive test script (`examples/test-ttl-functionality.js`) that tests:

1. **TTL Configuration Retrieval**
2. **Job Submission with TTL Tracking**
3. **Job Status with TTL Information**
4. **Queue Statistics with TTL Config**
5. **Job Completion and Cleanup Monitoring**
6. **Manual Cleanup Operations**

### Running Tests

```bash
# Update JWT token in the script
node examples/test-ttl-functionality.js
```

## Performance Impact

### Memory Management

- **Before TTL**: Jobs accumulated indefinitely in Redis
- **After TTL**: Automatic cleanup prevents memory bloat
- **Cleanup Overhead**: Minimal - uses setTimeout for delayed cleanup

### Redis Memory Usage

| Scenario | Before TTL | After TTL |
|----------|------------|-----------|
| **1000 jobs/day** | Continuous growth | Stable (max 3 days) |
| **Memory usage** | Linear increase | Bounded |
| **Cleanup cost** | Manual intervention | Automatic |

## Configuration Customization

### Environment Variables

```env
# Optional: Override default TTL settings
JOB_DATA_TTL_DAYS=3
COMPLETED_JOB_CLEANUP_MINUTES=1
FAILED_JOB_CLEANUP_MINUTES=5
PERIODIC_CLEANUP_HOURS=1
```

### Runtime Configuration

```javascript
// Custom TTL for specific job types
const customJobOptions = getJobOptionsWithTTL({
  ttl: 24 * 60 * 60 * 1000, // 1 day for urgent jobs
  delay: 0 // No delay for urgent processing
});
```

## Troubleshooting

### Common Issues

1. **Jobs disappearing too quickly**
   - Check TTL configuration
   - Verify cleanup delays
   - Review job completion times

2. **Memory still growing**
   - Ensure periodic cleanup is running
   - Check for failed cleanup operations
   - Monitor Redis memory usage

3. **Manual cleanup not working**
   - Verify admin role permissions
   - Check Redis connectivity
   - Review error logs

### Debug Commands

```bash
# Check Redis memory usage
redis-cli info memory

# List all job keys
redis-cli keys "bull:*"

# Monitor Redis operations
redis-cli monitor

# Check queue sizes
redis-cli llen "bull:bulk-upload-mechanics:waiting"
```

## Future Enhancements

### Planned Features

1. **Configurable TTL per job type**
2. **TTL metrics and analytics**
3. **Advanced cleanup strategies**
4. **TTL-based alerting**
5. **Backup before cleanup option**

### Extensibility

The TTL system is designed to be extensible:

```javascript
// Custom cleanup strategies
const customCleanupStrategy = {
  completedJobDelay: 30 * 1000,  // 30 seconds
  failedJobDelay: 10 * 60 * 1000, // 10 minutes
  periodicInterval: 30 * 60 * 1000 // 30 minutes
};
```

## Conclusion

The TTL implementation provides:

- ✅ **Automatic memory management**
- ✅ **Configurable cleanup policies**
- ✅ **Real-time TTL tracking**
- ✅ **Admin control over cleanup**
- ✅ **Comprehensive monitoring**
- ✅ **Zero-downtime operation**

This ensures the bulk upload system remains performant and maintainable while providing users with adequate access to job data and results. 