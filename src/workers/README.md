# Cron Worker for 24Hr Service

This directory contains background workers for the 24Hr Service application.

## Cron Worker (`cronWorker.js`)

A background worker that automatically calls the process-batches endpoint every 2 minutes to trigger mechanic calling workflows.

### Features

- ⏰ **Scheduled Execution**: Runs every 2 minutes automatically
- 📊 **Detailed Logging**: Shows execution status, response times, and statistics
- 🔄 **Error Handling**: Graceful error handling with retry logic
- 📈 **Status Reports**: Periodic status reports every 10 minutes
- 🛡️ **Safety Features**: Prevents overlapping executions
- 🔧 **Configurable**: Environment-based configuration

### Quick Start

#### Option 1: Using npm scripts

```bash
# Development mode (with auto-restart)
npm run cron:worker:dev

# Production mode
npm run cron:worker
```

#### Option 2: Using the startup script

```bash
node start-cron-worker.js
```

#### Option 3: Direct execution

```bash
node src/workers/cronWorker.js
```

### Configuration

Create a `.env` file or set environment variables:

```env
# Optional: Override the default endpoint URL
CRON_ENDPOINT_URL=https://two4hourservice-backend.onrender.com/api/v1/cron/process-batches

# Optional: Set timezone (default: UTC)
TZ=America/New_York

# Optional: Node environment
NODE_ENV=production
```

### Log Output

The worker provides detailed logging:

```
🚀 CronBatchProcessor starting...
📅 Schedule: */2 * * * * (Every 2 minutes)
🎯 Target endpoint: https://two4hourservice-backend.onrender.com/api/v1/cron/process-batches
⏰ Started at: 2024-01-01T12:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CronBatchProcessor scheduled successfully
🔄 Next execution in ~2 minutes

🔄 [2024-01-01T12:02:00.000Z] Starting batch processing (Run #1)
✅ [2024-01-01T12:02:01.245Z] Batch processing completed successfully
📊 Response time: 1245ms
📈 Results: {
  "processed": 3,
  "skipped": 1,
  "errors": 0,
  "calls_made": 3
}
📞 Calls made: 3
✅ Processed: 3
⏭️ Skipped: 1
❌ Errors: 0
🏁 [2024-01-01T12:02:01.245Z] Job execution completed
```

### Status Reports

Every 10 minutes, the worker logs a status report:

```
📊 ═══════════════════════════════════════════════════════════════════════════════
📈 CronBatchProcessor Status Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Uptime: 20 minutes
🔄 Total runs: 10
✅ Successful: 9
❌ Failed: 1
📊 Success rate: 90.0%
🕐 Last run: 2024-01-01T12:20:00.000Z
🔄 Currently running: No
🎯 Target: https://two4hourservice-backend.onrender.com/api/v1/cron/process-batches
═══════════════════════════════════════════════════════════════════════════════
```

### Deployment

#### Local Development

```bash
npm run cron:worker:dev
```

#### Production Server

```bash
# Using PM2 (recommended for production)
pm2 start src/workers/cronWorker.js --name "cron-worker"

# Using forever
forever start src/workers/cronWorker.js

# Using systemd service
sudo systemctl start cron-worker
```

#### Docker

```dockerfile
# Add to your Dockerfile
CMD ["node", "src/workers/cronWorker.js"]
```

### Monitoring

The worker provides several monitoring features:

- **Real-time logs**: All executions are logged with timestamps
- **Response times**: Track API response performance
- **Success rates**: Monitor reliability over time
- **Error details**: Detailed error reporting for troubleshooting

### Graceful Shutdown

The worker handles shutdown signals gracefully:

- `Ctrl+C` (SIGINT)
- SIGTERM
- Uncaught exceptions
- Unhandled promise rejections

### Troubleshooting

#### Worker won't start

- Check Node.js version (requires Node 14+)
- Verify all dependencies are installed: `npm install`
- Check for syntax errors: `node -c src/workers/cronWorker.js`

#### API calls failing

- Verify the endpoint URL is correct
- Check network connectivity
- Verify server is running and accessible
- Check API authentication if required

#### High error rates

- Monitor server logs for the target endpoint
- Check server performance and load
- Verify network stability
- Consider adjusting timeout values

### Advanced Configuration

You can modify the worker behavior by editing `src/workers/cronWorker.js`:

- **Schedule**: Change the `SCHEDULE` constant (cron format)
- **Timeout**: Adjust the fetch timeout value
- **Retry Logic**: Add custom retry mechanisms
- **Additional Endpoints**: Call multiple endpoints
- **Custom Logging**: Integrate with external logging services
