# Quick Setup Guide for Background Workers with TTL

## 1. Install Dependencies

```bash
npm install bull ioredis
```

## 2. Install and Start Redis

### Windows
1. Download Redis from https://redis.io/download
2. Install and start the Redis server
3. Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

### macOS
```bash
brew install redis
brew services start redis
```

### Ubuntu/Linux
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

## 3. Environment Configuration

Add to your `.env` file:
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 4. Start the Background Worker

In a separate terminal:
```bash
npm run worker
```

Or for development with auto-restart:
```bash
npm run worker:dev
```

## 5. TTL (Time To Live) Features

The system now includes comprehensive TTL functionality:

### ⏰ TTL Configuration
- **Job Data TTL**: 3 days (jobs automatically expire)
- **Completed Job Cleanup**: 1 minute after completion
- **Failed Job Cleanup**: 5 minutes after failure
- **Periodic Cleanup**: Every hour to remove expired jobs

### 🎯 TTL Features
- ✅ **Automatic Cleanup** - Jobs cleaned up after completion
- ✅ **TTL Tracking** - Real-time TTL information in job status
- ✅ **Manual Cleanup** - Admin-triggered cleanup operations
- ✅ **Periodic Cleanup** - Hourly cleanup of expired jobs
- ✅ **TTL Monitoring** - Configuration and status endpoints

## 6. Test the System

### Submit a mechanics bulk upload job:
```bash
curl -X POST http://localhost:3000/api/v1/bulk-upload/mechanics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '[
    {
      "firstName": "John",
      "lastName": "Doe", 
      "email": "john@example.com",
      "mobileNumber": "1234567890"
    }
  ]'
```

### Submit a policies bulk upload job:
```bash
curl -X POST http://localhost:3000/api/v1/bulk-upload/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '[
    {
      "policy_number": "POL-2024-001",
      "insured_first_name": "John",
      "insured_last_name": "Doe",
      "policy_effective_date": "01/01/2024",
      "policy_expiration_date": "01/01/2025",
      "risk_address_line_1": "123 Main St",
      "risk_address_city": "Anytown",
      "risk_address_state": "CA",
      "risk_address_zip_code": "12345"
    }
  ]'
```

### Check job status (with TTL info):
```bash
curl -X GET http://localhost:3000/api/v1/jobs/bulk-upload-policies/JOB_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Monitor queue statistics (with TTL config):
```bash
curl -X GET http://localhost:3000/api/v1/queues/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get TTL configuration:
```bash
curl -X GET http://localhost:3000/api/v1/jobs/ttl/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Trigger manual cleanup (admin only):
```bash
curl -X POST http://localhost:3000/api/v1/jobs/cleanup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 7. Production Deployment

Use PM2 for production:
```bash
# Install PM2
npm install -g pm2

# Start the worker
pm2 start src/workers/index.js --name "bulk-upload-worker"

# Monitor
pm2 monit

# View logs
pm2 logs bulk-upload-worker
```

## Available Endpoints

### Bulk Upload Endpoints
- `POST /api/v1/bulk-upload/mechanics` - Submit mechanics bulk upload
- `POST /api/v1/bulk-upload/service-providers` - Submit service providers bulk upload  
- `POST /api/v1/bulk-upload/policies` - Submit policies bulk upload

### Job Monitoring Endpoints
- `GET /api/v1/jobs/{queueName}/{jobId}/status` - Check job status (with TTL info)
- `GET /api/v1/queues/stats` - View all queue statistics (with TTL config)

### TTL Management Endpoints
- `GET /api/v1/jobs/ttl/config` - Get TTL configuration
- `POST /api/v1/jobs/cleanup` - Manual cleanup (admin only)

### Legacy Policy Routes (for backward compatibility)
- `POST /api/v1/policies/bulk` - Submit policies bulk upload
- `POST /api/v1/policies/bulkupload` - Submit policies bulk upload

## TTL Response Examples

### Job Status with TTL Information
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

### TTL Configuration Response
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
      }
    },
    "features": {
      "automaticCleanup": true,
      "periodicCleanup": true,
      "manualCleanup": true,
      "ttlTracking": true
    }
  }
}
```

## Features

✅ **Asynchronous Processing** - Jobs run in background  
✅ **Progress Tracking** - Real-time job progress updates  
✅ **Error Handling** - Automatic retries with exponential backoff  
✅ **Organization Security** - Users can only access their organization's jobs  
✅ **Queue Monitoring** - Statistics and health monitoring  
✅ **Scalable** - Can run multiple worker processes  
✅ **Policy Support** - Full policy bulk upload implementation  
✅ **TTL Management** - 3-day TTL with 1-minute cleanup after completion  
✅ **Automatic Cleanup** - Periodic and manual cleanup operations  
✅ **TTL Tracking** - Real-time TTL information in job status  

## Test Scripts

Run the TTL functionality test:
```bash
# Update JWT token in the script first
node examples/test-ttl-functionality.js
```

Run the policy bulk upload test:
```bash
# Update JWT token in the script first
node examples/test-policy-bulk-upload.js
```

## TTL Monitoring

### Automatic Features
- Jobs are automatically cleaned up 1 minute after completion
- Failed jobs are cleaned up 5 minutes after failure
- Periodic cleanup runs every hour to remove expired jobs
- All jobs have a 3-day TTL from creation

### Manual Management
- Admins can trigger manual cleanup via API
- TTL configuration can be viewed via API
- Job status includes real-time TTL information
- Queue statistics include TTL configuration

For detailed documentation, see `docs/BACKGROUND_WORKERS.md` 