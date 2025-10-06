# Redis Connection Fix Guide

## Problem
The error `ERR value is not an integer or out of range` occurs because the `REDIS_DB` environment variable is set to `'default'` instead of a numeric value.

## Quick Fix

### Option 1: Update your .env file
Change your `.env` file from:
```env
REDIS_DB=default
```

To:
```env
REDIS_DB=0
```

### Option 2: Remove REDIS_DB entirely
If you don't need a specific database, simply remove or comment out the `REDIS_DB` line:
```env
# REDIS_DB=default
```

## Your Current Configuration
Based on the error output, your Redis configuration should be:

```env
# Redis Configuration
REDIS_HOST=redis-14122.c245.us-east-1-3.ec2.redns.redis-cloud.com
REDIS_PORT=14122
REDIS_PASSWORD=O8ydJm62Sx0Oe9r6MF3tYdkekXFPjbMA
REDIS_DB=0
```

## Test the Fix

1. **Check your configuration:**
   ```bash
   npm run check-redis
   ```

2. **Start the worker:**
   ```bash
   npm run worker
   ```

## What Was Fixed

1. **Redis Client (`src/services/queue/redisClient.js`)**
   - Added proper parsing for `REDIS_DB` environment variable
   - Handles `'default'` string and converts it to `0`
   - Validates database numbers (0-15 range)
   - Added better error handling and logging

2. **Queue Manager (`src/services/queue/queueManager.js`)**
   - Applied the same parsing logic for Bull queues
   - Ensures consistent database configuration

3. **Added Diagnostic Script (`scripts/check-redis-config.js`)**
   - Tests Redis connection
   - Validates configuration
   - Provides specific error guidance

## Common Redis Database Values

| Value | Description |
|-------|-------------|
| `0` | Default database (recommended) |
| `1-15` | Additional databases (if supported) |
| `default` | ❌ Invalid - causes the error you saw |

## Verification Steps

After making the change:

1. The worker should start without Redis errors
2. You should see: `✅ Redis client ready`
3. No more `ERR value is not an integer or out of range` errors

## If You Still Have Issues

Run the diagnostic script:
```bash
npm run check-redis
```

This will:
- Show your current configuration
- Test the Redis connection
- Provide specific error guidance
- Suggest fixes for common issues 