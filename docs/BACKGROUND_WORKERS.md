# Background Workers for Bulk Upload Operations

This document explains the Redis-based background worker system for handling bulk upload operations asynchronously.

## Overview

The background worker system processes bulk upload operations for:
- **Mechanics** - Bulk upload of mechanic records
- **Service Providers** - Bulk upload of service provider records  
- **Policies** - Bulk upload of policy records

## Architecture

```
Client Request → API Controller → Redis Queue → Background Worker → Database
                      ↓
                 Job ID Response ← Job Status Monitoring
```

## Components

### 1. Redis Client (`src/services/queue/redisClient.js`)
- Manages Redis connection
- Handles connection events and error handling
- Configurable via environment variables

### 2. Queue Manager (`src/services/queue/queueManager.js`)
- Creates and manages Bull queues for each bulk upload type
- Provides job creation and status monitoring functions
- Handles job retry logic and cleanup

### 3. Background Worker (`src/workers/bulkUploadWorker.js`)
- Processes jobs from Redis queues
- Executes bulk upload operations
- Reports progress and handles errors

### 4. Controllers (`src/controllers/bulkUpload.controller.js`)
- API endpoints for submitting bulk upload jobs
- Job status monitoring endpoints
- Queue statistics endpoints

## Environment Configuration

Add these variables to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Installation

1. **Install Redis dependencies:**
```bash
npm install ioredis bull
```

2. **Install and start Redis server:**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# macOS with Homebrew
brew install redis
brew services start redis

# Windows
# Download and install Redis from https://redis.io/download
```

## Usage

### 1. Start the Background Worker

Run the worker as a separate process:

```bash
# Development
node src/workers/index.js

# Production (with PM2)
pm2 start src/workers/index.js --name "bulk-upload-worker"
```

### 2. Submit Bulk Upload Jobs

#### Mechanics Bulk Upload
```bash
POST /api/v1/bulk-upload/mechanics
Content-Type: application/json
Authorization: Bearer <token>

[
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "mobileNumber": "1234567890"
  }
]
```

#### Service Providers Bulk Upload
```bash
POST /api/v1/bulk-upload/service-providers
Content-Type: application/json
Authorization: Bearer <token>

[
  {
    "name": "Provider Name",
    "email": "provider@example.com"
  }
]
```

#### Policies Bulk Upload
```bash
POST /api/v1/bulk-upload/policies
Content-Type: application/json
Authorization: Bearer <token>

[
  {
    "policyNumber": "POL123",
    "type": "auto"
  }
]
```

### 3. Monitor Job Status

#### Check Specific Job Status
```bash
GET /api/v1/jobs/{queueName}/{jobId}/status
Authorization: Bearer <token>
```

Example response:
```json
{
  "success": true,
  "data": {
    "jobId": "123",
    "status": "completed",
    "progress": 100,
    "result": {
      "success": true,
      "uploaded": 150,
      "message": "Mechanics bulk upload completed successfully"
    },
    "createdAt": "2024-01-01T10:00:00.000Z",
    "completedAt": "2024-01-01T10:05:00.000Z",
    "queueName": "bulk-upload-mechanics"
  }
}
```

#### Check Queue Statistics
```bash
GET /api/v1/queues/stats
Authorization: Bearer <token>
```

## Job Lifecycle

1. **Queued** - Job added to Redis queue
2. **Active** - Worker picked up the job
3. **Progress** - Job is being processed (0-100%)
4. **Completed** - Job finished successfully
5. **Failed** - Job failed (will retry up to 3 times)

## Security Features

- **Organization Isolation** - Users can only see jobs from their organization
- **Authentication Required** - All endpoints require valid JWT token
- **Organization Membership** - User must belong to an organization
- **Job Data Validation** - Input data is validated before queuing

## Error Handling

- **Automatic Retries** - Failed jobs retry up to 3 times with exponential backoff
- **Error Logging** - All errors are logged with context
- **Graceful Degradation** - API remains responsive even if Redis is down
- **Job Cleanup** - Completed jobs are automatically cleaned up

## Monitoring

### Queue Statistics
Monitor queue health via:
- `/api/v1/queues/stats` - All queue statistics
- `/api/v1/queues/{queueName}/stats` - Specific queue statistics

### Logs
Worker logs include:
- Job start/completion events
- Progress updates
- Error details
- Performance metrics

### Redis Monitoring
Use Redis CLI to monitor:
```bash
redis-cli monitor
redis-cli info
```

## Production Deployment

### 1. Process Management
Use PM2 for production deployment:

```bash
# Start worker
pm2 start src/workers/index.js --name "bulk-upload-worker"

# Monitor
pm2 monit

# Logs
pm2 logs bulk-upload-worker
```

### 2. Redis Configuration
For production, configure Redis with:
- Persistence enabled
- Memory optimization
- Security settings
- Clustering (if needed)

### 3. Scaling
- Run multiple worker processes for higher throughput
- Use Redis Cluster for high availability
- Monitor memory usage and job queue sizes

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify connection credentials
   - Check network connectivity

2. **Jobs Stuck in Queue**
   - Ensure worker process is running
   - Check worker logs for errors
   - Verify database connectivity

3. **High Memory Usage**
   - Adjust job cleanup settings
   - Monitor queue sizes
   - Consider Redis memory optimization

### Debug Commands

```bash
# Check Redis connection
redis-cli ping

# List all keys
redis-cli keys "*"

# Monitor Redis activity
redis-cli monitor

# Check queue status
redis-cli llen "bull:bulk-upload-mechanics:waiting"
```

## API Reference

### Bulk Upload Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/bulk-upload/mechanics` | Submit mechanics bulk upload |
| POST | `/api/v1/bulk-upload/service-providers` | Submit service providers bulk upload |
| POST | `/api/v1/bulk-upload/policies` | Submit policies bulk upload |

### Monitoring Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/jobs/{queueName}/{jobId}/status` | Get job status |
| GET | `/api/v1/queues/{queueName}/stats` | Get queue statistics |
| GET | `/api/v1/queues/stats` | Get all queue statistics |

### Queue Names

- `bulk-upload-mechanics`
- `bulk-upload-service-providers`
- `bulk-upload-policies` 