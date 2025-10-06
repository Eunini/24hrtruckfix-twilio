# Frontend Integration Guide: nextContactHourInterval Feature

## Overview
The backend has been enhanced to support dynamic message timing intervals through the `nextContactHourInterval` field. This allows campaigns to have different time intervals between messages instead of the previous fixed 10-minute interval.

## API Changes

### 1. Campaign Creation Endpoint
**Endpoint:** `POST /api/v1/campaigns`

**New Field Support:**
```json
{
  "name": "Campaign Name",
  "organization_id": "your_org_id",
  "messagesList": [
    {
      "id": 1,
      "message": "First message content",
      "nextContactHourInterval": 2  // NEW: Hours to wait before next message
    },
    {
      "id": 2,
      "message": "Second message content", 
      "nextContactHourInterval": 4  // NEW: Hours to wait before next message
    }
  ]
}
```

### 2. Add Messages to Campaign Endpoint
**Endpoint:** `POST /api/v1/campaigns/{campaignId}/messages`

**New Field Support:**
```json
{
  "messages": [
    {
      "id": 3,
      "message": "New message content",
      "nextContactHourInterval": 6  // NEW: Hours to wait before next message
    }
  ]
}
```

## Field Specifications

### nextContactHourInterval
- **Type:** Number
- **Required:** Yes (has default value of 1)
- **Minimum Value:** 1 hour
- **Description:** Specifies how many hours to wait before sending the next message in the sequence
- **Default:** 1 hour (if not provided)

## Validation Rules

The backend now validates:
1. `nextContactHourInterval` must be a number
2. `nextContactHourInterval` must be >= 1
3. If not provided, defaults to 1 hour

**Error Response Example:**
```json
{
  "success": false,
  "message": "nextContactHourInterval must be a number with minimum value of 1"
}
```

## Database Schema Changes

The `messagesList` array in campaigns now includes:
```javascript
{
  id: Number,           // Existing
  message: String,      // Existing  
  nextContactHourInterval: Number  // NEW: Required, min: 1, default: 1
}
```

## Campaign Timer System Updates

The campaign processing system now:
- Uses individual message `nextContactHourInterval` values instead of fixed 10-minute intervals
- Calculates next message timing dynamically based on each message's interval setting
- Processes leads only when their specific interval time has elapsed

## Frontend Implementation Guidelines

### 1. Message Form Updates
Add an input field for `nextContactHourInterval` in your message creation/editing forms:

```jsx
// Example React component structure
<input 
  type="number" 
  min="1" 
  value={message.nextContactHourInterval || 1}
  onChange={(e) => setMessage({
    ...message, 
    nextContactHourInterval: parseInt(e.target.value)
  })}
  placeholder="Hours until next message"
/>
```

### 2. Campaign Creation
When creating campaigns, include `nextContactHourInterval` for each message:

```javascript
const campaignData = {
  name: campaignName,
  organization_id: orgId,
  messagesList: messages.map(msg => ({
    id: msg.id,
    message: msg.content,
    nextContactHourInterval: msg.interval || 1  // Default to 1 if not set
  }))
};
```

### 3. Adding Messages to Existing Campaigns
When adding new messages to campaigns:

```javascript
const newMessages = {
  messages: messagesToAdd.map(msg => ({
    id: msg.id,
    message: msg.content,
    nextContactHourInterval: msg.interval || 1
  }))
};
```

## UI/UX Recommendations

### 1. Message Interval Input
- Use a number input with minimum value of 1
- Consider adding helper text: "Hours to wait before sending the next message"
- Default value should be 1 hour
- Consider using a dropdown for common intervals (1, 2, 4, 6, 12, 24 hours)

### 2. Campaign Overview
- Display the interval timing in campaign message lists
- Show something like: "Message 1 → Wait 2 hours → Message 2 → Wait 4 hours → Message 3"

### 3. Validation Feedback
- Show real-time validation for interval values
- Highlight invalid values (< 1) with error styling
- Provide clear error messages matching backend validation

## Testing Endpoints

You can test the new functionality using these curl commands:

### Create Campaign with Intervals:
```bash
curl -X POST "http://localhost:3000/api/v1/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Campaign",
    "organization_id": "YOUR_ORG_ID",
    "messagesList": [
      {
        "id": 1,
        "message": "First message",
        "nextContactHourInterval": 2
      }
    ]
  }'
```

### Add Messages with Intervals:
```bash
curl -X POST "http://localhost:3000/api/v1/campaigns/CAMPAIGN_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messages": [
      {
        "id": 2,
        "message": "Second message",
        "nextContactHourInterval": 4
      }
    ]
  }'
```

## Migration Notes

### Existing Campaigns
- Existing campaigns without `nextContactHourInterval` will use the default value of 1 hour
- No data migration is required as the field has a default value
- The system is backward compatible

### Existing Messages
- Messages created before this update will automatically get `nextContactHourInterval: 1`
- The campaign timer system will respect these default values

## Summary of Changes

1. ✅ **Database Schema**: Added `nextContactHourInterval` field to campaign messages
2. ✅ **API Endpoints**: Updated create and add message endpoints to handle the new field
3. ✅ **Validation**: Added proper validation for the interval field
4. ✅ **Campaign Timer**: Updated processing logic to use dynamic intervals
5. ✅ **Backward Compatibility**: Maintained compatibility with existing campaigns

## Questions or Issues?

If you encounter any issues during integration, please check:
1. Ensure `nextContactHourInterval` is a number >= 1
2. Verify the field is included in your API requests
3. Check that your authentication token is valid
4. Review the error messages for specific validation failures

The backend is fully ready to support dynamic message intervals. All endpoints have been tested and are working correctly with the new functionality.