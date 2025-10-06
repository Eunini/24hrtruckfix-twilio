# Inbound AI Upgrade Documentation

This document describes the upgraded phone number management system that automatically handles phone number provisioning and deprovisioning based on the `inboundAi` setting in organizations.

## Overview

The system now intelligently manages phone numbers and VAPI assistants when the `inboundAi` setting is updated on an organization:

- **When `inboundAi` is enabled**: Checks if a phone number exists, and if not, purchases one and links it to VAPI
- **When `inboundAi` is disabled**: Releases the phone number from both VAPI and Twilio
- **Assistant Reuse**: If assistants already exist, they are reused instead of creating new ones

## Key Features

### ✅ Intelligent Phone Number Management

- **Automatic Provisioning**: Purchases phone numbers only when needed
- **Full Release**: Completely releases phone numbers from both VAPI and Twilio when disabled
- **Assistant Reuse**: Reuses existing assistants instead of creating duplicates

### ✅ Cost Optimization

- **No Duplicate Assistants**: Prevents unnecessary assistant creation
- **Complete Cleanup**: Fully releases resources when disabled
- **Efficient Resource Usage**: Only purchases phone numbers when actually needed

### ✅ Error Handling

- **Non-blocking**: Phone number management errors don't break organization updates
- **Comprehensive Logging**: Detailed logs for debugging and monitoring
- **Graceful Degradation**: System continues to work even if phone number operations fail

## How It Works

### When `inboundAi` is Set to `true`

1. **Check Existing Configuration**

   - Look for existing AI configuration for the organization
   - Check if a phone number already exists

2. **Phone Number Management**

   - If no phone number exists: Purchase a new Twilio phone number
   - If phone number exists: Ensure it's active

3. **Assistant Management**

   - If assistants exist: Reuse existing inbound and outbound assistants
   - If no assistants exist: Create new VAPI assistants

4. **VAPI Integration**
   - Register the phone number with VAPI using the inbound assistant
   - Save/update the AI configuration in the database

### When `inboundAi` is Set to `false`

1. **VAPI Cleanup**

   - Delete the phone number registration from VAPI
   - Release the phone number from VAPI

2. **Twilio Cleanup**

   - Release the phone number from Twilio
   - This stops billing for the phone number

3. **Database Cleanup**
   - Set AI configuration status to `inactive`
   - Clear phone number data (number, SID, VAPI ID)
   - Mark setup as incomplete

## API Usage

### Update Organization with Inbound AI

```http
PUT /api/v1/organizations/:id
```

**Request Body:**

```json
{
  "inboundAi": true,
  "companyName": "Updated Company Name",
  "otherFields": "other values"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Organization updated successfully",
  "organization": {
    "id": "org_id",
    "inboundAi": true,
    "companyName": "Updated Company Name",
    "status": "verified"
  }
}
```

### Check AI Status

```http
GET /api/v1/organizations/:id/ai-status
```

**Response:**

```json
{
  "organization": {
    "id": "org_id",
    "inboundAi": true,
    "companyName": "Test Company"
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

## Database Schema Changes

### AI Config Model Updates

The AI configuration now supports:

- **Assistant Reuse**: Existing assistant IDs are preserved
- **Complete Cleanup**: Phone number data is cleared when disabled
- **Status Tracking**: Active/inactive status for better management

```javascript
{
  client_id: ObjectId,           // Organization owner
  organization_id: ObjectId,     // Organization reference
  outbound_assistant_id: String, // VAPI outbound assistant ID (preserved)
  inbound_assistant_id: String,  // VAPI inbound assistant ID (preserved)
  number: String,                // Phone number (null when released)
  phone_number_sid: String,      // Twilio SID (null when released)
  vapi_phone_number_id: String,  // VAPI ID (null when released)
  status: String,                // 'active' or 'inactive'
  setup_completed: Boolean,      // Setup completion status
  setup_date: Date,              // When setup was completed
  createdAt: Date,
  updatedAt: Date
}
```

## Testing

### Test Scenarios

1. **Enable Inbound AI (No Existing Setup)**

   - Should purchase phone number
   - Should create new assistants
   - Should register with VAPI

2. **Enable Inbound AI (Existing Setup)**

   - Should reuse existing assistants
   - Should purchase new phone number
   - Should register with VAPI

3. **Disable Inbound AI**

   - Should release from VAPI
   - Should release from Twilio
   - Should clear phone number data

4. **Re-enable Inbound AI**
   - Should reuse existing assistants
   - Should purchase new phone number
   - Should register with VAPI

### Running Tests

```bash
# Set environment variables
export API_BASE_URL="http://localhost:3000/api/v1"
export AUTH_TOKEN="your_auth_token"

# Run the test
node examples/test-inbound-ai-upgrade.js
```

## Environment Variables

Required environment variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# VAPI Configuration
VAPI_API_KEY=your_vapi_api_key

# Server Configuration
SERVER_URL=https://your-api-domain.com
```

## Monitoring and Logging

### Key Log Messages

**Phone Number Management:**

- `🔄 InboundAi setting changed from false to true`
- `📞 Checking phone number status for organization: {orgId}`
- `🆕 No phone number found - purchasing new phone number`
- `✅ Phone number purchased: {number}`

**Assistant Management:**

- `🔄 Using existing assistants for organization: {orgId}`
- `🆕 Creating new VAPI assistants for organization: {orgId}`
- `✅ Using existing assistants - Inbound: {id}, Outbound: {id}`

**VAPI Integration:**

- `✅ Phone number registered with VAPI: {id}`
- `✅ VAPI phone number released: {id}`

**Twilio Integration:**

- `✅ Twilio phone number released: {sid}`

**Database Operations:**

- `✅ AI configuration created for organization: {orgId}`
- `✅ AI configuration updated for organization: {orgId}`
- `✅ AI configuration deactivated and phone number data cleared`

### Error Handling

Errors in phone number management are logged but don't break the organization update:

```
❌ Error managing phone number for organization {orgId}: {error}
❌ Failed to release phone number: {error}
```

## Migration Guide

### For Existing Organizations

1. **Organizations with Existing AI Setup**

   - Existing assistants will be reused
   - Phone numbers will be managed based on `inboundAi` setting
   - No data migration required

2. **Organizations without AI Setup**
   - Will get phone numbers when `inboundAi` is enabled
   - Will have assistants created on first enable

### Backward Compatibility

- All existing API endpoints continue to work
- Organization updates without `inboundAi` changes are unaffected
- Existing AI configurations are preserved

## Troubleshooting

### Common Issues

1. **Phone Number Purchase Fails**

   - Check Twilio credentials
   - Verify account has available phone numbers
   - Check billing status

2. **VAPI Registration Fails**

   - Verify VAPI API key
   - Check assistant IDs are valid
   - Ensure server URL is accessible

3. **Assistant Creation Fails**
   - Check VAPI API key
   - Verify organization data is complete
   - Check server URL configuration

### Debug Steps

1. Check logs for specific error messages
2. Verify environment variables are set correctly
3. Test API endpoints manually
4. Check database for AI configuration status

## Future Enhancements

### Planned Features

1. **Phone Number Pooling**

   - Reuse phone numbers across organizations
   - Reduce costs for inactive organizations

2. **Advanced Assistant Management**

   - Assistant templates
   - Custom assistant configurations

3. **Enhanced Monitoring**

   - Phone number usage analytics
   - Cost tracking and reporting

4. **Bulk Operations**
   - Bulk enable/disable inbound AI
   - Bulk phone number management
