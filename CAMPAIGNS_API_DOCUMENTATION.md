# Campaigns API Documentation

This document provides comprehensive information about the Campaigns API endpoints for frontend integration.

## Base URL
```
/api/v1/campaigns
```

## Authentication
All endpoints require authentication. Include the authorization token in the request headers:
```
Authorization: Bearer <your_token>
```

## Campaign Endpoints

### 1. Create Campaign
**POST** `/api/v1/campaigns`

**Request Body:**
```json
{
  "name": "Summer Sale Campaign",
  "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
  "messagesList": [
    "Welcome to our summer sale!",
    "Don't miss out on 50% off!"
  ],
  "createdBy": "60f7b3b3b3b3b3b3b3b3b3b3"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Campaign created successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Summer Sale Campaign",
    "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "isActive": true,
    "messagesList": [
      "Welcome to our summer sale!",
      "Don't miss out on 50% off!"
    ],
    "createdBy": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "draft",
    "createdAt": "2023-07-20T10:30:00.000Z",
    "updatedAt": "2023-07-20T10:30:00.000Z"
  }
}
```

### 2. Get All Campaigns
**GET** `/api/v1/campaigns?page=1&limit=10&organization_id=60f7b3b3b3b3b3b3b3b3b3b3`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `organization_id` (required): Organization ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaigns retrieved successfully",
  "data": {
    "campaigns": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "name": "Summer Sale Campaign",
        "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "isActive": true,
        "messagesList": ["Welcome to our summer sale!"],
        "status": "active",
        "createdAt": "2023-07-20T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

### 3. Get Campaign by ID
**GET** `/api/v1/campaigns/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign retrieved successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Summer Sale Campaign",
    "organization_id": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "ABC Company"
    },
    "isActive": true,
    "messagesList": ["Welcome to our summer sale!"],
    "createdBy": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "John Doe"
    },
    "status": "active",
    "createdAt": "2023-07-20T10:30:00.000Z",
    "updatedAt": "2023-07-20T10:30:00.000Z"
  }
}
```

### 4. Update Campaign
**PUT** `/api/v1/campaigns/:id`

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "messagesList": ["Updated message 1", "Updated message 2"],
  "status": "active"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign updated successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Updated Campaign Name",
    "messagesList": ["Updated message 1", "Updated message 2"],
    "status": "active",
    "updatedAt": "2023-07-20T11:30:00.000Z"
  }
}
```

### 5. Delete Campaign
**DELETE** `/api/v1/campaigns/:id`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

### 6. Add Messages to Campaign (Bulk)
**POST** `/api/v1/campaigns/:id/messages`

**Request Body:**
```json
{
  "messages": [
    "New message 1",
    "New message 2",
    "New message 3"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Messages added to campaign successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "messagesList": [
      "Welcome to our summer sale!",
      "New message 1",
      "New message 2",
      "New message 3"
    ]
  }
}
```

### 7. Toggle Campaign Status
**PATCH** `/api/v1/campaigns/:id/toggle-status`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign status updated successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "isActive": false,
    "status": "inactive"
  }
}
```

### 8. Get Campaign Statistics
**GET** `/api/v1/campaigns/:id/stats`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign statistics retrieved successfully",
  "data": {
    "campaignId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "totalLeads": 150,
    "activeLeads": 120,
    "contactedLeads": 80,
    "convertedLeads": 25,
    "totalMessages": 5,
    "totalSequences": 45,
    "completedSequences": 30,
    "conversionRate": 16.67,
    "contactRate": 53.33
  }
}
```

## Campaign Leads Endpoints

### 9. Add Single Lead
**POST** `/api/v1/campaigns/:id/leads`

**Request Body:**
```json
{
  "name": "John Smith",
  "phoneNumber": "+1234567890",
  "notes": "Interested in premium package"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Lead added to campaign successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "John Smith",
    "phoneNumber": "+1234567890",
    "campaign_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "active",
    "contactAttempts": 0,
    "notes": "Interested in premium package",
    "createdAt": "2023-07-20T10:30:00.000Z"
  }
}
```

### 10. Add Multiple Leads (Bulk)
**POST** `/api/v1/campaigns/:id/leads/bulk`

**Request Body:**
```json
{
  "leads": [
    {
      "name": "Alice Johnson",
      "phoneNumber": "+1234567891",
      "notes": "Referral from website"
    },
    {
      "name": "Bob Wilson",
      "phoneNumber": "+1234567892",
      "notes": "Cold lead"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "2 leads added to campaign successfully",
  "data": {
    "addedLeads": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
        "name": "Alice Johnson",
        "phoneNumber": "+1234567891",
        "status": "active"
      },
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
        "name": "Bob Wilson",
        "phoneNumber": "+1234567892",
        "status": "active"
      }
    ],
    "totalAdded": 2
  }
}
```

### 11. Get Campaign Leads
**GET** `/api/v1/campaigns/:id/leads?page=1&limit=10`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (active, inactive, contacted, converted)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Campaign leads retrieved successfully",
  "data": {
    "leads": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "name": "John Smith",
        "phoneNumber": "+1234567890",
        "status": "active",
        "contactAttempts": 2,
        "lastContactedAt": "2023-07-20T09:30:00.000Z",
        "notes": "Interested in premium package",
        "createdAt": "2023-07-20T08:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

### 12. Update Lead
**PUT** `/api/v1/campaigns/leads/:leadId`

**Request Body:**
```json
{
  "name": "John Smith Jr.",
  "phoneNumber": "+1234567899",
  "status": "contacted",
  "notes": "Follow up scheduled for next week"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "John Smith Jr.",
    "phoneNumber": "+1234567899",
    "status": "contacted",
    "notes": "Follow up scheduled for next week",
    "updatedAt": "2023-07-20T11:30:00.000Z"
  }
}
```

### 13. Delete Lead
**DELETE** `/api/v1/campaigns/leads/:leadId`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

## Messaging Sequence Endpoints

### 14. Create Messaging Sequence
**POST** `/api/v1/campaigns/messaging-sequence`

**Request Body:**
```json
{
  "message": "Thank you for your interest! Here's more information...",
  "campaign_id": "60f7b3b3b3b3b3b3b3b3b3b3",
  "campaignLead_id": "60f7b3b3b3b3b3b3b3b3b3b4",
  "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
  "sequenceOrder": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Messaging sequence created successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
    "message": "Thank you for your interest! Here's more information...",
    "campaign_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "campaignLead_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "organization_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "sequenceOrder": 1,
    "status": "pending",
    "createdAt": "2023-07-20T10:30:00.000Z"
  }
}
```

### 15. Get Messaging Sequences
**GET** `/api/v1/campaigns/:id/messaging-sequences?page=1&limit=10`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (pending, sent, delivered, failed)
- `campaignLead_id` (optional): Filter by specific lead

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Messaging sequences retrieved successfully",
  "data": {
    "sequences": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
        "message": "Thank you for your interest!",
        "campaign_id": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
          "name": "Summer Sale Campaign"
        },
        "campaignLead_id": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "name": "John Smith",
          "phoneNumber": "+1234567890"
        },
        "sequenceOrder": 1,
        "status": "sent",
        "sentAt": "2023-07-20T10:35:00.000Z",
        "createdAt": "2023-07-20T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 15,
      "itemsPerPage": 10
    }
  }
}
```

### 16. Update Messaging Sequence
**PUT** `/api/v1/campaigns/messaging-sequence/:sequenceId`

**Request Body:**
```json
{
  "message": "Updated message content",
  "status": "delivered",
  "deliveredAt": "2023-07-20T10:40:00.000Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Messaging sequence updated successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
    "message": "Updated message content",
    "status": "delivered",
    "deliveredAt": "2023-07-20T10:40:00.000Z",
    "updatedAt": "2023-07-20T11:30:00.000Z"
  }
}
```

## Error Responses

### Validation Error (400 Bad Request)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Campaign name is required"
    },
    {
      "field": "phoneNumber",
      "message": "Invalid phone number format"
    }
  ]
}
```

### Not Found Error (404 Not Found)
```json
{
  "success": false,
  "message": "Campaign not found"
}
```

### Unauthorized Error (401 Unauthorized)
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details for debugging"
}
```

## Status Values

### Campaign Status
- `draft`: Campaign is being created/edited
- `active`: Campaign is running
- `paused`: Campaign is temporarily stopped
- `completed`: Campaign has finished
- `archived`: Campaign is archived

### Lead Status
- `active`: Lead is active in the campaign
- `inactive`: Lead is temporarily inactive
- `contacted`: Lead has been contacted
- `converted`: Lead has converted to customer
- `unsubscribed`: Lead has opted out

### Messaging Sequence Status
- `pending`: Message is queued to be sent
- `sent`: Message has been sent
- `delivered`: Message has been delivered
- `failed`: Message delivery failed
- `read`: Message has been read (if supported)

## Rate Limits
- Standard endpoints: 100 requests per minute
- Bulk operations: 10 requests per minute
- Statistics endpoints: 50 requests per minute

## Notes for Frontend Development

1. **Pagination**: All list endpoints support pagination. Always check the `pagination` object in responses.

2. **Error Handling**: Always check the `success` field in responses. Handle different HTTP status codes appropriately.

3. **Phone Number Format**: Phone numbers should include country code (e.g., +1234567890).

4. **Date Formats**: All dates are in ISO 8601 format (UTC).

5. **Population**: Some endpoints automatically populate related data (organization, user details). Check the response structure.

6. **Bulk Operations**: Use bulk endpoints for better performance when adding multiple leads.

7. **Real-time Updates**: Consider implementing WebSocket connections for real-time campaign statistics updates.

8. **File Uploads**: For future enhancements, file upload endpoints may be added for CSV lead imports.

## Example Frontend Integration

```javascript
// Example: Create a new campaign
const createCampaign = async (campaignData) => {
  try {
    const response = await fetch('/api/v1/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(campaignData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Campaign created:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

// Example: Get campaign statistics
const getCampaignStats = async (campaignId) => {
  try {
    const response = await fetch(`/api/v1/campaigns/${campaignId}/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
};
```

This documentation should provide your frontend developer with all the necessary information to integrate with the campaigns API effectively.