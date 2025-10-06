# Webhook and Cron Job Migration Guide

## Overview

This document outlines the migration of serverless webhook functions and cron jobs to Express.js API endpoints. The migration provides better control, monitoring, and debugging capabilities while maintaining the same functionality.

## Migration Summary

### What Was Migrated

1. **VAPI Webhook Functions** (Serverless → Express.js)
   - `outbound_hooks.js` → `/api/v1/outbound-hook`
   - `Inbound_hooks.js` → `/api/v1/inbound-hook`
   - Legacy `/api/v1/call-mechanics` endpoint

2. **Cron Job Functions** (Serverless → API Endpoints)
   - Ticket batch processing → `/api/v1/cron/process-batches`
   - Cleanup operations → `/api/v1/cron/cleanup`
   - Statistics monitoring → `/api/v1/cron/stats`

## New API Endpoints

### Webhook Endpoints

#### 1. Inbound Webhook
```http
POST /api/v1/inbound-hook?sid={system_id}
Content-Type: application/json

{
  "message": {
    "type": "assistant-request",
    "phoneNumber": { "number": "+1234567890" },
    "call": { "id": "call_123" }
  }
}
```

#### 2. Outbound Webhook
```http
POST /api/v1/outbound-hook?sid={system_id}
Content-Type: application/json

{
  "message": {
    "type": "assistant-request",
    "phoneNumber": { "number": "+1234567890" },
    "call": { "id": "call_123" }
  }
}
```

#### 3. Call Mechanics (Legacy)
```http
POST /api/v1/call-mechanics?sid={system_id}
```
*Routes to outbound webhook for backward compatibility*

#### 4. Webhook Health Check
```http
GET /api/v1/webhook/health
```

#### 5. Webhook Testing
```http
POST /api/v1/webhook/test
Content-Type: application/json

{
  "type": "inbound",
  "phoneNumber": "+1234567890",
  "sid": "507f1f77bcf86cd799439011"
}
```

### Cron Job Endpoints

#### 1. Process Ticket Batches (Main Cron Job)
```http
POST /api/v1/cron/process-batches
Authorization: Bearer {jwt_token}
```
*Now uses direct VAPI API calls instead of buildship endpoints*

#### 2. Get Tracking Statistics
```http
GET /api/v1/cron/stats
Authorization: Bearer {jwt_token}
```

#### 3. Cleanup Expired Records
```http
POST /api/v1/cron/cleanup
Authorization: Bearer {jwt_token}
```

#### 4. Process Specific Ticket
```http
POST /api/v1/cron/process-ticket/{ticketId}
Authorization: Bearer {jwt_token}
```

#### 5. Run Maintenance Cycle
```http
POST /api/v1/cron/maintenance
Authorization: Bearer {jwt_token}
```

#### 6. Cron Health Check
```http
GET /api/v1/cron/health
```

#### 7. Schedule Configuration
```http
GET /api/v1/cron/schedule-config
```

## VAPI Integration

### Direct API Calls
The cron job service now makes direct calls to the VAPI API (`https://api.vapi.ai/call/phone`) instead of using buildship proxy endpoints. This provides:

- **Better Control**: Direct access to VAPI features and configurations
- **Improved Reliability**: Eliminates proxy layer dependencies
- **Enhanced Monitoring**: Direct API response tracking
- **Cost Optimization**: Reduced external service dependencies

### Mechanic Call Types
The system supports two types of mechanic calls:

1. **Standard Mechanics** (`hasOnboarded: false`)
   - Uses environment variable `VAPI_API_KEY`
   - Basic onboarding flow with form submission
   - SMS sent via `https://kklayn.buildship.run/send-sms`

2. **Experienced Mechanics** (`hasOnboarded: true`)
   - Uses hardcoded API key for experienced mechanic flow
   - Streamlined conversation script
   - SMS sent via `https://kklayn.buildship.run/send-sms-exp`

### Dynamic System Prompts
The system generates dynamic system prompts based on:
- Mechanic experience level (standard vs experienced)
- Job requirements (towing vs repair)
- Ticket details (vehicle info, breakdown location, etc.)
- Company information and branding

## Architecture

### File Structure
```
src/
├── services/
│   ├── webhook.service.js      # Core webhook logic
│   └── cronJob.service.js      # Core cron job logic
├── controllers/
│   ├── webhook.controller.js   # HTTP request handlers
│   └── cronJob.controller.js   # HTTP request handlers
├── routes/
│   ├── webhook.routes.js       # Route definitions
│   └── cronJob.routes.js       # Route definitions
└── models/
    └── tracking.model.js       # Tracking data model
```

### Key Components

#### 1. Webhook Service (`src/services/webhook.service.js`)
- Handles VAPI event processing
- Generates assistant configurations
- Manages error responses
- Integrates with AI models and database

#### 2. Cron Job Service (`src/services/cronJob.service.js`)
- Processes ticket batches
- Manages mechanic calling logic
- Handles cleanup operations
- Provides statistics and monitoring

#### 3. Controllers
- Handle HTTP requests/responses
- Validate input parameters
- Call appropriate service methods
- Format responses

#### 4. Models
- `Tracking`: Manages ticket processing state
- `SystemStatus`: System activation status
- `AIConfig`: AI assistant configurations
- `Onboarding`: Client configuration data

## Migration Benefits

### 1. Better Debugging
- Centralized logging
- Request/response tracking
- Error stack traces
- Performance monitoring

### 2. Enhanced Monitoring
- Health check endpoints
- Statistics endpoints
- Real-time status monitoring
- Performance metrics

### 3. Improved Control
- Manual trigger capabilities
- Granular error handling
- Configurable timeouts
- Authentication protection

### 4. Scalability
- Connection pooling
- Optimized database queries
- Parallel processing
- Resource management

## Configuration

### Environment Variables
```env
MONGODB_URI=mongodb://...
AI_MONGODB_URI=mongodb://...
MONGODB_STATUS_ID=507f1f77bcf86cd799439011
PHONE=+1234567890
TO_EMAIL=admin@example.com
GOOGLE_API_KEY=your_google_api_key
VAPI_API_KEY=your_vapi_api_key_here
```

### Authentication
Cron job endpoints require JWT authentication:
```javascript
headers: {
  'Authorization': 'Bearer your_jwt_token'
}
```

## Scheduling

### External Scheduler Configuration
Use the `/api/v1/cron/schedule-config` endpoint to get recommended schedules:

```json
{
  "mainProcessing": {
    "endpoint": "/api/v1/cron/process-batches",
    "method": "POST",
    "schedule": "*/2 * * * *"
  },
  "cleanup": {
    "endpoint": "/api/v1/cron/cleanup", 
    "method": "POST",
    "schedule": "*/10 * * * *"
  }
}
```

### Cron Job Examples
```bash
# Process batches every 2 minutes
*/2 * * * * curl -X POST http://localhost:3000/api/v1/cron/process-batches \
  -H "Authorization: Bearer $JWT_TOKEN"

# Cleanup every 10 minutes  
*/10 * * * * curl -X POST http://localhost:3000/api/v1/cron/cleanup \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Testing

### Running Tests
```bash
# Run the test suite
node examples/test-webhook-and-cron-migration.js

# Test individual components
npm test -- --grep "webhook"
npm test -- --grep "cron"
```

### Manual Testing
```bash
# Test webhook health
curl http://localhost:3000/api/v1/webhook/health

# Test cron health
curl http://localhost:3000/api/v1/cron/health

# Test webhook functionality
curl -X POST http://localhost:3000/api/v1/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"type":"inbound","phoneNumber":"+1234567890","sid":"507f1f77bcf86cd799439011"}'
```

## Error Handling

### Webhook Errors
- Always return HTTP 200 for VAPI compatibility
- Error details in response body
- Graceful degradation for missing data

### Cron Job Errors
- Detailed error logging
- Partial success handling
- Retry mechanisms
- Error aggregation

## Monitoring

### Health Checks
- `/api/v1/webhook/health` - Webhook service status
- `/api/v1/cron/health` - Cron service status with statistics

### Metrics
- Processing times
- Success/failure rates
- Active tracking records
- System resource usage

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify JWT token validity
   - Check token expiration
   - Ensure proper Authorization header

2. **Database Connection Issues**
   - Verify MongoDB URI
   - Check network connectivity
   - Monitor connection pool

3. **Webhook Processing Errors**
   - Validate VAPI event format
   - Check system status
   - Verify AI configuration

4. **Cron Job Failures**
   - Check tracking data integrity
   - Verify external API endpoints
   - Monitor timeout settings

### Debug Mode
Enable detailed logging:
```javascript
process.env.DEBUG = 'webhook:*,cron:*';
```

## Performance Optimization

### Database Optimization
- Indexed queries
- Projection limiting
- Connection pooling
- Query optimization

### API Optimization
- Request validation
- Response caching
- Parallel processing
- Timeout management

## Security Considerations

### Authentication
- JWT token validation
- Role-based access control
- Rate limiting
- Request validation

### Data Protection
- Input sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

## Future Enhancements

### Planned Features
1. Real-time monitoring dashboard
2. Advanced analytics
3. Auto-scaling capabilities
4. Enhanced error recovery
5. Performance optimization
6. Advanced scheduling options

### Migration Path
1. Deploy new endpoints alongside existing
2. Gradually migrate traffic
3. Monitor performance and errors
4. Decommission serverless functions
5. Optimize based on usage patterns

## Support

For issues or questions regarding the migration:
1. Check the health endpoints first
2. Review logs for error details
3. Run the test suite
4. Consult this documentation
5. Contact the development team

---

*Last updated: [Current Date]*
*Version: 1.0.0* 