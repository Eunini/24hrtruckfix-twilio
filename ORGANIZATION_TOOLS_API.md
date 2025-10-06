# Organization Tools Management API Documentation

## Overview

This API allows organizations using default prompts to manage their available tools. Organizations can configure which tools are available for their AI assistants, providing better control over functionality.

## Available Tools

The system supports the following tools:

- **endcall** - Allows the AI to end phone calls
- **bookappointment** - Enables appointment booking functionality (requires calendar connection)
- **knowledgebase** - Provides access to organization's knowledge base
- **calltransfer** - Allows transferring calls to other numbers with configurable summary

## API Endpoints

### 1. Manage Organization Tools

**POST** `/api/tools/organization/manage`

#### Request Headers
```
Content-Type: application/json
Authorization: Bearer <your-jwt-token>
```

#### Request Body
```json
{
  "organizationId": "string (required)",
  "toolName": "string (required) - one of: endcall, bookappointment, knowledgebase, calltransfer",
  "action": "string (required) - either 'add' or 'remove'",
  "metadata": "object (optional) - additional tool configuration"
}
```

#### Example Request - Adding a Tool
```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "bookappointment",
  "action": "add",
  "metadata": {
    "description": "Book appointments with our service team",
    "timeSlots": ["9:00-17:00"]
  }
}
```

#### Example Request - Adding Call Transfer Tool
```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "calltransfer",
  "action": "add",
  "metadata": {
    "transferNumber": "+1234567890",
    "transferMessage": "Transferring you to our specialist",
    "summaryContent": "Please provide a detailed summary of the customer's issue and any relevant information discussed during this call to help the receiving agent assist them effectively."
  }
}
```

#### Example Request - Removing a Tool
```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "calltransfer",
  "action": "remove"
}
```

#### Response
```json
{
  "success": true,
  "message": "Tool updated successfully",
  "tools": [
    {
      "name": "endcall",
      "metadata": {}
    },
    {
      "name": "bookappointment",
      "metadata": {
        "description": "Book appointments with our service team",
        "timeSlots": ["9:00-17:00"]
      }
    }
  ]
}
```

#### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "message": "Missing required fields: organizationId, toolName, action"
}
```

**400 Bad Request** - Invalid tool name
```json
{
  "success": false,
  "message": "Invalid tool name. Must be one of: endcall, bookappointment, knowledgebase, calltransfer"
}
```

**400 Bad Request** - Calendar connection required
```json
{
  "success": false,
  "message": "Calendar connection is required for bookappointment tool"
}
```

### 2. Get Organization Tools

**GET** `/api/tools/organization/:organizationId`

#### Request Headers
```
Authorization: Bearer <your-jwt-token>
```

#### URL Parameters
- `organizationId` (string, required) - The organization ID

#### Example Request
```
GET /api/tools/organization/64f1a2b3c4d5e6f7g8h9i0j1
```

#### Response
```json
{
  "success": true,
  "tools": [
    {
      "name": "endcall",
      "metadata": {}
    },
    {
      "name": "knowledgebase",
      "metadata": {
        "searchDepth": "comprehensive"
      }
    },
    {
      "name": "bookappointment",
      "metadata": {
        "description": "Book appointments with our service team",
        "timeSlots": ["9:00-17:00"]
      }
    }
  ]
}
```

#### Error Responses

**404 Not Found** - Organization not found
```json
{
  "success": false,
  "message": "Organization not found"
}
```

## Frontend Integration Guide

### 1. Tool Management Interface

Create a tools management section in your organization settings page:

```javascript
// Example React component structure
const OrganizationToolsManager = ({ organizationId }) => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch current tools
  const fetchTools = async () => {
    try {
      const response = await fetch(`/api/tools/organization/${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTools(data.tools);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  // Add or remove tool
  const manageTool = async (toolName, action, metadata = {}) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tools/organization/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId,
          toolName,
          action,
          metadata
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setTools(data.tools);
        // Show success message
      } else {
        // Handle error
        console.error(data.message);
      }
    } catch (error) {
      console.error('Error managing tool:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Your UI components here
  );
};
```

### 2. Tool Configuration

#### Available Tools Configuration

```javascript
const AVAILABLE_TOOLS = [
  {
    name: 'endcall',
    displayName: 'End Call',
    description: 'Allows AI to end phone calls when appropriate',
    requiresCalendar: false
  },
  {
    name: 'bookappointment',
    displayName: 'Book Appointment',
    description: 'Enables appointment booking functionality',
    requiresCalendar: true
  },
  {
    name: 'knowledgebase',
    displayName: 'Knowledge Base',
    description: 'Provides access to organization knowledge base',
    requiresCalendar: false
  },
  {
    name: 'calltransfer',
    displayName: 'Call Transfer',
    description: 'Allows transferring calls to other numbers with configurable summary',
    requiresCalendar: false,
    metadata: {
      transferNumber: 'Phone number to transfer calls to',
      transferMessage: 'Message to play before transfer',
      summaryContent: 'Instructions for AI to provide call summary to receiving agent'
    }
  }
];
```

### 3. Error Handling

Implement proper error handling for common scenarios:

```javascript
const handleToolManagement = async (toolName, action) => {
  try {
    // Check if calendar connection is required
    if (toolName === 'bookappointment' && action === 'add') {
      const hasCalendar = await checkCalendarConnection(organizationId);
      if (!hasCalendar) {
        showError('Calendar connection is required for appointment booking. Please connect your calendar first.');
        return;
      }
    }

    await manageTool(toolName, action);
  } catch (error) {
    if (error.response?.status === 400) {
      showError(error.response.data.message);
    } else {
      showError('An error occurred while managing tools. Please try again.');
    }
  }
};
```

### 4. UI Recommendations

- **Toggle Interface**: Use toggle switches for each tool to enable/disable
- **Calendar Warning**: Show a warning icon next to "Book Appointment" if no calendar is connected
- **Tool Descriptions**: Display helpful descriptions for each tool
- **Loading States**: Show loading indicators during API calls
- **Success Feedback**: Provide clear feedback when tools are added/removed

### 5. Default Behavior

If an organization has no tools configured:
- The system automatically provides `endcall` and `knowledgebase` tools
- This ensures basic functionality is always available
- Frontend should reflect this default state

## Call Transfer Configuration Details

### When Users Set Call Transfer Summary

The call transfer summary and configuration values are set **when adding the calltransfer tool** through the API. Users configure these values in the `metadata` object when making the POST request to `/api/tools/organization/manage`.

### Call Transfer Metadata Fields

- **transferNumber** (string): The phone number to transfer calls to (e.g., "+1234567890")
- **transferMessage** (string): Message played to the caller before transfer (e.g., "Transferring you to our specialist")
- **summaryContent** (string): Instructions for the AI on what summary to provide to the receiving agent

### How Call Transfer Summary Works

1. **Configuration Time**: Users set the `summaryContent` when adding the calltransfer tool via API
2. **During Transfer**: The AI uses the configured `summaryContent` as instructions for generating the call summary
3. **Transfer Process**: The AI provides a summary to the receiving agent based on the configured instructions
4. **Summary Generation**: The AI automatically generates the actual summary content based on the call conversation and the provided instructions

### Example Summary Instructions

```json
{
  "summaryContent": "Please provide a detailed summary including: 1) Customer's main issue or request, 2) Any troubleshooting steps already attempted, 3) Customer's contact information, 4) Urgency level, and 5) Any specific requirements mentioned."
}
```

## Important Notes

1. **Authentication**: All endpoints require valid JWT authentication
2. **Calendar Dependency**: The `bookappointment` tool requires an active calendar connection
3. **Default Tools**: Organizations always have access to basic tools even if none are explicitly configured
4. **Metadata**: The metadata field allows for future extensibility and custom tool configurations
5. **Real-time Updates**: Tools changes take effect immediately for new AI assistant conversations
6. **Call Transfer Summary**: Summary instructions are configured once when adding the tool, not during each call

## Testing

Test your integration with these scenarios:

1. **Add Tool**: Add each type of tool and verify it appears in the list
2. **Remove Tool**: Remove tools and verify they're removed from the list
3. **Calendar Validation**: Try adding `bookappointment` without calendar connection
4. **Error Handling**: Test with invalid organization IDs and tool names
5. **Authentication**: Test with invalid/expired tokens

This API provides a clean interface for managing organization tools while maintaining backward compatibility and ensuring reliable default functionality.