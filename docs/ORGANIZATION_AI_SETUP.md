# Organization AI Setup Upgrade

This document describes the new automatic AI setup functionality that triggers when an organization is approved for the first time.

## Overview

When an organization is approved (`status: "verified"`), the system automatically:

1. **Purchases a Twilio phone number** for the organization
2. **Creates two VAPI assistants** (inbound and outbound)
3. **Registers the phone number with VAPI**
4. **Saves the AI configuration** to the database
5. **Sends an approval email** to the organization owner

## Features

### ✅ Automatic AI Setup
- Triggered on first-time organization approval
- Complete phone number and assistant provisioning
- Automatic email notifications
- Comprehensive error handling and rollback

### ✅ VAPI Integration
- Creates named assistants: `{orgName} inbound` and `{orgName} outbound`
- Registers phone numbers with VAPI
- Manages assistant lifecycle (create, update, delete)

### ✅ Twilio Integration
- Purchases phone numbers automatically
- Supports country and area code preferences
- Manages phone number lifecycle

### ✅ Email Notifications
- Professional approval emails with setup details
- Failure notification emails with error details
- Responsive HTML templates with company branding

### ✅ Management Features
- Retry failed setups
- Cleanup AI configurations
- Status monitoring and reporting

## API Endpoints

### Organization Verification with AI Setup

```http
POST /api/organizations/:id/verify
```

**Request Body:**
```json
{
  "status": "verified",
  "countryCode": "US",
  "areaCode": "510"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Organization verified and AI setup completed successfully",
  "data": {
    "organization": {
      "id": "org_id",
      "status": "verified",
      "isVerified": true
    },
    "aiSetup": {
      "success": true,
      "setupTime": "2847ms",
      "data": {
        "phoneNumber": "+15105551234",
        "assistants": {
          "inbound": {
            "id": "asst_inbound_123",
            "name": "Company Name inbound"
          },
          "outbound": {
            "id": "asst_outbound_456",
            "name": "Company Name outbound"
          }
        },
        "emailSent": true
      }
    }
  }
}
```

### Get Organization with AI Status

```http
GET /api/organizations/:id/ai-status
```

**Response:**
```json
{
  "organization": {
    "id": "org_id",
    "companyName": "Test Company",
    "status": "verified",
    "isVerified": true
  },
  "aiSetup": {
    "hasSetup": true,
    "setupCompleted": true,
    "status": "active",
    "phoneNumber": "+15105551234",
    "assistants": {
      "inbound": "asst_inbound_123",
      "outbound": "asst_outbound_456"
    },
    "setupDate": "2024-01-15T10:30:00.000Z"
  }
}
```

### Retry AI Setup

```http
POST /api/organizations/:id/retry-ai-setup
```

**Request Body:**
```json
{
  "countryCode": "US",
  "areaCode": "415"
}
```

### Cleanup AI Setup

```http
DELETE /api/organizations/:id/ai-setup
```

**Response:**
```json
{
  "success": true,
  "message": "AI setup cleanup completed successfully",
  "data": {
    "cleanup": {
      "results": {
        "phoneNumberReleased": true,
        "inboundAssistantDeleted": true,
        "outboundAssistantDeleted": true,
        "vapiPhoneNumberDeleted": true,
        "configDeleted": true
      }
    }
  }
}
```

## Database Schema

### AI Config Model

```javascript
{
  client_id: ObjectId,           // Organization owner
  organization_id: ObjectId,     // Organization reference
  outbound_assistant_id: String, // VAPI outbound assistant ID
  inbound_assistant_id: String,  // VAPI inbound assistant ID
  number: String,                // Phone number (+15105551234)
  phone_number_sid: String,      // Twilio phone number SID
  vapi_phone_number_id: String,  // VAPI phone number ID
  status: String,                // 'active', 'inactive', 'suspended'
  setup_completed: Boolean,      // Setup completion status
  setup_date: Date,              // When setup was completed
  createdAt: Date,
  updatedAt: Date
}
```

## Environment Variables

Required environment variables for AI setup:

```bash
# VAPI Configuration
VAPI_API_KEY=your_vapi_api_key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Email Configuration
ADMIN_EMAIL_FROM_USER=notifications@yourdomain.com

# Server Configuration
SERVER_URL=https://your-api-domain.com
```

## Setup Process Flow

### 1. Organization Approval Trigger

```javascript
// When organization is approved for the first time
const result = await organizationService.verifyOrganization(orgId, 'verified', {
  countryCode: 'US',
  areaCode: '510'
});
```

### 2. AI Setup Steps

1. **Fetch Organization Data**
   - Get organization and owner details
   - Validate organization exists and has owner

2. **Check Existing Configuration**
   - Prevent duplicate setups
   - Return existing config if found

3. **Purchase Phone Number**
   - Search available numbers in specified area
   - Purchase number via Twilio API
   - Store phone number SID

4. **Create VAPI Assistants**
   - Create inbound assistant: `{orgName} inbound`
   - Create outbound assistant: `{orgName} outbound`
   - Configure assistant settings and capabilities

5. **Register Phone with VAPI**
   - Register Twilio number with VAPI
   - Associate with inbound assistant
   - Configure call routing

6. **Save Configuration**
   - Store all IDs and settings in database
   - Mark setup as completed
   - Set status to active

7. **Send Notification Email**
   - Send approval email with setup details
   - Include phone number and assistant info
   - Provide next steps and support info

### 3. Error Handling

- **Graceful Rollback**: Failed setups are cleaned up automatically
- **Email Notifications**: Failure emails sent to organization owner
- **Detailed Logging**: Each step logged with timestamps
- **Retry Capability**: Failed setups can be retried with cleanup

## Email Templates

### Approval Email Features

- **Professional Design**: Responsive HTML with company branding
- **Setup Details**: Phone number, assistant IDs, setup date
- **Next Steps**: Instructions for getting started
- **Support Information**: Contact details for help

### Failure Email Features

- **Error Details**: Failed step and error message
- **Timestamp**: When the failure occurred
- **Support Contact**: How to get help resolving issues

## Testing

### Test Script Usage

```bash
# Run the test script
node examples/test-organization-ai-setup.js
```

### Test Functions Available

```javascript
const {
  testOrganizationApproval,
  testAISetupRetry,
  testAISetupCleanup,
  testFullOrganizationFlow,
  testConfiguration
} = require('./examples/test-organization-ai-setup.js');

// Test individual functions
await testOrganizationApproval();
await testAISetupRetry();
await testConfiguration();
```

## Monitoring and Troubleshooting

### Common Issues

1. **VAPI API Key Invalid**
   ```
   Error: VAPI_API_KEY environment variable is required
   ```
   **Solution**: Set valid VAPI API key in environment

2. **Twilio Credentials Missing**
   ```
   Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required
   ```
   **Solution**: Configure Twilio credentials

3. **Phone Number Purchase Failed**
   ```
   Error: No available phone numbers in area code 510
   ```
   **Solution**: Try different area code or country

4. **Assistant Creation Failed**
   ```
   Error: Failed to create VAPI assistant
   ```
   **Solution**: Check VAPI API limits and account status

### Monitoring Setup Status

```javascript
// Check organization AI setup status
const status = await organizationService.getOrganizationWithAIStatus(orgId);

if (!status.aiSetup.hasSetup) {
  // No AI setup found
  console.log('Organization needs AI setup');
} else if (!status.aiSetup.setupCompleted) {
  // Setup in progress or failed
  console.log('Setup incomplete, may need retry');
} else {
  // Setup complete and active
  console.log('AI setup active and ready');
}
```

### Cleanup and Retry

```javascript
// Cleanup failed setup
await organizationService.cleanupAISetup(orgId);

// Retry setup with different options
await organizationService.retryAISetup(orgId, {
  countryCode: 'US',
  areaCode: '415'
});
```

## Performance Considerations

### Setup Time Expectations

- **Typical Setup Time**: 15-30 seconds
- **Phone Number Purchase**: 3-8 seconds
- **Assistant Creation**: 5-10 seconds each
- **VAPI Registration**: 2-5 seconds
- **Database Operations**: 1-2 seconds
- **Email Sending**: 1-3 seconds

### Optimization Features

- **Parallel Operations**: Where possible, operations run in parallel
- **Efficient Error Handling**: Quick failure detection and rollback
- **Minimal Database Queries**: Optimized data fetching
- **Background Processing**: Email sending doesn't block setup

## Security Considerations

### API Key Management

- Store API keys securely in environment variables
- Use different keys for development and production
- Rotate keys regularly

### Phone Number Security

- Phone numbers are purchased and owned by your Twilio account
- Numbers can be released and reassigned as needed
- Monitor usage to prevent abuse

### Data Protection

- AI configurations contain sensitive phone and assistant data
- Implement proper access controls
- Log access for audit purposes

## Integration Examples

### Manual Organization Approval

```javascript
// Approve organization with AI setup
app.post('/admin/organizations/:id/approve', async (req, res) => {
  try {
    const result = await organizationService.verifyOrganization(
      req.params.id,
      'verified',
      {
        countryCode: req.body.countryCode || 'US',
        areaCode: req.body.areaCode
      }
    );
    
    res.json({
      success: true,
      message: 'Organization approved and AI setup initiated',
      data: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Webhook Integration

```javascript
// Handle organization approval webhook
app.post('/webhooks/organization-approved', async (req, res) => {
  const { organizationId, approvalData } = req.body;
  
  try {
    const result = await organizationService.verifyOrganization(
      organizationId,
      'verified',
      approvalData
    );
    
    // Log successful setup
    console.log('AI setup completed for organization:', organizationId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('AI setup failed:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Setup Success Rates**
   - Track failed setups and common errors
   - Optimize based on failure patterns

2. **Clean Up Orphaned Resources**
   - Identify and clean up unused phone numbers
   - Remove inactive assistant configurations

3. **Update Assistant Configurations**
   - Keep assistant prompts and settings current
   - Deploy configuration updates to existing assistants

4. **Monitor Costs**
   - Track Twilio and VAPI usage costs
   - Optimize resource allocation

### Getting Help

For issues with the AI setup system:

1. **Check Logs**: Review application logs for detailed error information
2. **Test Configuration**: Use the test script to verify environment setup
3. **Contact Support**: Reach out with specific error messages and organization IDs

---

## Changelog

### Version 1.0.0 (Current)
- Initial implementation of automatic AI setup
- VAPI and Twilio integration
- Email notification system
- Comprehensive error handling and retry logic
- Management and monitoring endpoints
- Test suite and documentation 