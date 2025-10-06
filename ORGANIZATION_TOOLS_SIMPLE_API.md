# Organization Tools Management - Simplified API

## Overview

Simple API for managing organization tools. Most tools use `null` metadata, except call transfer which requires specific configuration.

## Available Tools

- **endcall** - End phone calls (metadata: `null`)
  - **When to use**: When the conversation has reached a natural conclusion, customer's issue is resolved, or when the call needs to be terminated gracefully
- **bookappointment** - Book appointments (metadata: `null`, requires calendar connection)
  - **When to use**: When customers need to schedule services, consultations, or follow-up appointments. Requires active calendar integration
- **calltransfer** - Transfer calls with summary (metadata: required)
  - **When to use**: When the customer's issue requires specialized expertise, escalation to a supervisor, or when the AI cannot adequately resolve the inquiry

## API Endpoints

### 1. Unified Tools Management (Recommended)

**POST** `/api/tools/update`

This unified endpoint supports updating tools for both organizations and custom prompts.

#### Headers

```
Content-Type: application/json
Authorization: Bearer <token>
```

#### Request Body Options

**For Organization Tools:**

```json
{
  "organizationId": "your-org-id",
  "toolName": "tool-name",
  "action": "add" | "remove",
  "metadata": null | object
}
```

**For Custom Prompt Tools:**

```json
{
  "promptId": "your-prompt-id",
  "promptType": "custom" | "client",
  "toolName": "tool-name",
  "action": "add" | "remove",
  "metadata": null | object
}
```

### 2. Get Tools by Prompt ID

**GET** `/api/tools/prompt/:promptId?promptType=custom|client`

#### Headers

```
Authorization: Bearer <token>
```

#### Query Parameters

- `promptType`: Required. Either "custom" or "client"

#### Response

```json
{
  "tools": [
    {
      "name": "tool-name",
      "metadata": null | object
    }
  ]
}
```

### 2. Get Organization Tools

**GET** `/api/tools/organization/:organizationId`

#### Headers

```
Authorization: Bearer <token>
```

## Examples

### Organization Tools Examples (using unified endpoint)

#### Add End Call Tool to Organization

```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "endcall",
  "action": "add",
  "metadata": null
}
```

#### Add Book Appointment Tool to Organization

```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "bookappointment",
  "action": "add",
  "metadata": null
}
```

#### Add Call Transfer Tool to Organization

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

### Custom Prompt Tools Examples (using unified endpoint)

#### Add End Call Tool to Custom Prompt

```json
{
  "promptId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "promptType": "custom",
  "toolName": "endcall",
  "action": "add",
  "metadata": null
}
```

#### Add Call Transfer Tool to Client Prompt

```json
{
  "promptId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "promptType": "client",
  "toolName": "calltransfer",
  "action": "add",
  "metadata": {
    "transferNumber": "+1234567890",
    "transferMessage": "Transferring you to our specialist",
    "summaryContent": "Please provide a detailed summary of the customer's issue and any relevant information discussed during this call to help the receiving agent assist them effectively."
  }
}
```

### Remove Tools Examples

#### Remove Tool from Organization

```json
{
  "organizationId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "toolName": "calltransfer",
  "action": "remove"
}
```

#### Remove Tool from Custom Prompt

```json
{
  "promptId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "promptType": "client",
  "toolName": "bookappointment",
  "action": "remove"
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Tool updated successfully",
  "tools": [
    {
      "name": "endcall",
      "metadata": null
    },
    {
      "name": "calltransfer",
      "metadata": {
        "transferNumber": "+1234567890",
        "transferMessage": "Transferring you to our specialist",
        "summaryContent": "Please provide a detailed summary..."
      }
    }
  ]
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description"
}
```

## Key Points

1. **Unified endpoint supports both organization and prompt tools**
2. **Available tools: endcall, bookappointment, calltransfer**
3. **Most tools use `metadata: null`**
4. **Only calltransfer requires metadata configuration**
5. **bookappointment needs calendar connection**
6. **promptType required when using promptId ("custom" or "client")**
7. **Provide either organizationId OR promptId, not both**
8. **Changes apply immediately to new conversations**
9. **Authentication required for all requests**

## Call Transfer Metadata Fields

- `transferNumber`: Phone number to transfer to
- `transferMessage`: Message before transfer
- `summaryContent`: AI instructions for call summary

That's it! Simple and straightforward.
