# VAPI Integration Endpoints

This document describes the VAPI integration endpoints that have been implemented to handle function calls from the VAPI AI system.

## Overview

The VAPI (Voice AI Platform) integration allows the AI assistant to make function calls to our backend services during phone conversations. Two main endpoints have been implemented:

1. **Policy Validation**: `/api/v1/policies/validate`
2. **Ticket Creation**: `/api/v1/create-ticket`

## Endpoints

### 1. Policy Validation Endpoint

**URL**: `POST /api/v1/policies/validate`

**Purpose**: Validates insurance policy numbers during AI phone calls.

**VAPI Request Format**:

```json
{
  "message": {
    "type": "tool-calls",
    "call": { "id": "call_123", "customer": { "number": "+1234567890" } },
    "toolCalls": [
      {
        "id": "call_xyz789",
        "type": "function",
        "function": {
          "name": "validatePolicy",
          "arguments": {
            "policy_number": "ABC123"
          }
        }
      }
    ]
  }
}
```

**VAPI Response Format**:

```json
{
  "results": [
    {
      "toolCallId": "call_xyz789",
      "result": "{\"exists\":true,\"expired\":false,\"message\":\"The policy exists and is still valid\"}"
    }
  ]
}
```

**Response Cases**:

- **Valid Policy**: `{"exists": true, "expired": false, "message": "The policy exists and is still valid"}`
- **Expired Policy**: `{"exists": true, "expired": true, "message": "The policy exists but is expired"}`
- **Invalid Policy**: `{"exists": false, "expired": null, "message": "Policy does not exist"}`

### 2. Ticket Creation Endpoint

**URL**: `POST /api/v1/create-ticket`

**Purpose**: Creates service tickets for roadside assistance during AI phone calls using proper authentication.

**VAPI Request Format**:

```json
{
  "message": {
    "type": "tool-calls",
    "call": {
      "id": "call_123",
      "customer": { "number": "+1234567890" },
      "assistant": { "id": "assistant_abc123" }
    },
    "toolCalls": [
      {
        "id": "call_def456",
        "type": "function",
        "function": {
          "name": "ticketCreator",
          "arguments": {
            "policy_number": "ABC123",
            "customer_name": "John Doe",
            "vehicle_make": "Honda",
            "vehicle_model": "Civic",
            "breakdown_reason": "Flat tire",
            "service_type": "roadside_repair",
            "schedule_time": "immediate"
          }
        }
      }
    ]
  }
}
```

**VAPI Response Format**:

```json
{
  "results": [
    {
      "toolCallId": "call_def456",
      "result": "{\"success\":true,\"ticket_id\":\"507f1f77bcf86cd799439011\",\"message\":\"Your service ticket has been created successfully. You will receive a text message with a form to provide your exact location.\",\"next_steps\":\"Please fill out the location form when you receive the text message.\"}"
    }
  ]
}
```

## Function Parameters

### validatePolicy Parameters

- `policy_number` (string, required): The complete policy number including letters and numbers

### ticketCreator Parameters

- `policy_number` (string, optional): The validated policy number
- `customer_name` (string, optional): Customer's full name (required for self-pay)
- `customer_phone` (string, optional): Customer's phone number (extracted from call)
- `vehicle_make` (string, optional): Make of the vehicle (e.g., Honda, Toyota)
- `vehicle_model` (string, optional): Model of the vehicle (e.g., Camry, Odyssey)
- `vehicle_color` (string, optional): Color of the vehicle
- `vehicle_year` (string, optional): Year of the vehicle
- `vehicle_type` (string, optional): Type of vehicle (e.g., sedan, truck, SUV)
- `license_plate` (string, optional): Vehicle license plate number
- `service_type` (string, required): Type of service needed: 'tow' or 'roadside_repair'
- `tow_destination` (string, optional): Full address where vehicle should be towed
- `schedule_time` (string, required): When service is needed: 'immediate' or specific date/time
- `breakdown_reason` (string, required): Detailed description of the vehicle issue
- `is_self_pay` (boolean, optional): True if customer is paying out of pocket
- `policy_valid` (boolean, optional): Whether the policy validation was successful

## Implementation Details

### VAPI Request Format

The endpoints now use the updated VAPI format:

- **Request Structure**: `message.toolCalls[]` instead of `message.functionCall`
- **Parameters**: `toolCall.function.arguments` (object) instead of `functionCall.parameters` (JSON string)
- **Tool ID**: Each tool call has an `id` field that must be returned in the response

### Response Format

All responses now use the standardized format:

```json
{
  "results": [
    {
      "toolCallId": "matching_tool_call_id",
      "result": "stringified_json_result"
    }
  ]
}
```

### Policy Validation Logic

1. Extracts policy number from VAPI tool call arguments
2. Searches for policy in the database with case-insensitive regex matching
3. Checks if policy exists and is not expired
4. Returns appropriate response in VAPI format with toolCallId

### Ticket Creation Logic

The ticket creation endpoint follows proper authentication flow:

1. **Extract Assistant ID**: Gets the `call.assistantId` from the VAPI request
2. **Lookup Organization**: Uses the assistant ID to find the associated AI configuration and organization
3. **Get API Key**: Retrieves the organization owner's API key from the user collection
4. **Fetch Policy Details**: If a policy number is provided, fetches complete policy information from the database
5. **Map Data**: Maps VAPI parameters to ticket data, using policy data to fill missing fields
6. **Authenticated Request**: Makes an authenticated HTTP request to the regular `/api/v1/tickets` endpoint using the API key
7. **Return Response**: Formats the response in VAPI-compatible format with toolCallId

**Authentication Flow**:

```
VAPI Request → Extract Assistant ID → Find AIConfig → Get Organization → Get Owner's API Key → Fetch Policy Data → Authenticated Ticket Creation
```

**Policy Data Integration**:
When a `policy_number` is provided, the system automatically fetches and includes:

- `policy_expiration_date`: From policy record (required by ticket validation)
- `policy_address`: Constructed from policy's risk address fields
- `insured_name`: Combined from policy's `insured_first_name` and `insured_last_name`
- `agency_name`: From policy record
- **Vehicle Details**: If not provided in VAPI call, uses policy's first vehicle data:
  - `vehicle_make`: From `vehicle_manufacturer`
  - `vehicle_model`: From policy vehicle data
  - `vehicle_color`: From policy vehicle data
  - `vehicle_year`: From `vehicle_model_year`
  - `license_plate_no`: From policy's `licensePlate`

**OpenAI Breakdown Reason Categorization**:
The system automatically categorizes the breakdown reason using OpenAI:

- Analyzes the `breakdown_reason` parameter using GPT-3.5-turbo
- Returns structured breakdown reason data with `label`, `key`, and `idx`
- Available categories:
  - Flat Tire (`flat_tire`, idx: 1)
  - Battery Replacement (`battery_replacement`, idx: 2)
  - Jump Start (`jump_start`, idx: 3)
  - Lockout (`lockout`, idx: 4)
  - Tire Replacement (`tire_replacement`, idx: 5)
  - Fuel Delivery (`fuel_delivery`, idx: 6)
  - Towing (`towing`, idx: 7)
  - Other (`other`, idx: 8) - default fallback
- Falls back to "Other" if OpenAI fails or API key is missing
- Uses optimized prompting for accurate categorization

**Cell Country Code Detection**:
The system automatically determines the country code from the customer's phone number:

- Uses `libphonenumber-js` for accurate phone number parsing
- Extracts country code from `call.customer.number` or `call.customerNumber`
- Returns country information in the format: `{ label: "US", id: "US", dialCode: "+1" }`
- Supports international phone numbers with proper country detection
- Falls back to US (+1) if phone number parsing fails
- Integrates with existing `cell_country_code` field in ticket model

**Data Priority**: VAPI parameters take precedence over policy data when both are available.

**Database Relationships**:

- `call.assistantId` → `AIConfig.inbound_assistant_id`
- `AIConfig.organization_id` → `Organization._id`
- `Organization.owner` → `User._id`
- `User.apiKey` → Used for authentication
- `parameters.policy_number` → `Policy.policy_number` (case-insensitive lookup)

### Error Handling

Both endpoints include comprehensive error handling:

- Invalid requests return appropriate error messages
- Database errors are caught and handled gracefully
- All responses use HTTP 200 status (as required by VAPI)
- Error details are logged for debugging
- Missing assistant ID or configuration errors are handled gracefully
- Each error response includes the correct `toolCallId`

### Backward Compatibility

The endpoints maintain backward compatibility:

- Non-VAPI requests to `/api/v1/policies/validate` still work as before
- The create-ticket endpoint detects legacy VAPI format and provides migration guidance
- Legacy format detection for smooth transition

## Testing

To test these endpoints, you can send VAPI-formatted requests to:

- `POST /api/v1/policies/validate` for policy validation
- `POST /api/v1/create-ticket` for ticket creation

**Important**: For ticket creation testing, ensure:

1. The assistant ID exists in the AIConfig collection
2. The organization and owner exist with a valid API key
3. The regular ticket creation endpoint is accessible
4. Use the new toolCalls format instead of functionCall

The endpoints will log detailed information about incoming requests and processing steps for debugging purposes.

## Configuration

Make sure the following environment variables are set:

- `SERVER_URL`: The base URL of your server (used in VAPI function configurations and internal API calls)
- `MONGODB_URI`: MongoDB connection string
- `OPENAI_API_KEY`: OpenAI API key for breakdown reason categorization (optional - falls back to "Other" if not provided)
- Any other required environment variables for the application

## Installation Requirements

To use the OpenAI breakdown reason categorization feature, install the OpenAI package:

```bash
npm install openai
```

To use the phone number parsing and country detection feature, install the libphonenumber-js package:

```bash
npm install libphonenumber-js
```

If the OpenAI package is not installed or the API key is not provided, the system will gracefully fall back to using "Other" as the default breakdown reason category.

If the libphonenumber-js package is not installed, the system will fall back to US (+1) as the default country code.

## Database Requirements

For the VAPI integration to work properly, ensure:

1. **AIConfig Collection**: Must contain records linking `inbound_assistant_id` to `organization_id`
2. **Organization Collection**: Must have valid `owner` references
3. **User Collection**: Organization owners must have valid `apiKey` values
4. **Proper Relationships**: All foreign key relationships must be properly established

## Integration with VAPI AI Assistant

These endpoints are configured in the AI assistant's function definitions (see `src/utils/prompts/insurance.prompt.js`) and will be called automatically during phone conversations when the AI determines that policy validation or ticket creation is needed.

### Migration from Legacy Format

If you're migrating from the old VAPI format:

**Old Format**:

```json
{
  "message": {
    "type": "function-call",
    "functionCall": {
      "name": "functionName",
      "parameters": "{\"param\":\"value\"}"
    }
  }
}
```

**New Format**:

```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [
      {
        "id": "call_id",
        "type": "function",
        "function": {
          "name": "functionName",
          "arguments": {
            "param": "value"
          }
        }
      }
    ]
  }
}
```
