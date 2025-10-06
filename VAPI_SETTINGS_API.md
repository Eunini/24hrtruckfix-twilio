# VAPI Assistant Call Settings API

This document describes the new VAPI assistant call settings API endpoints that allow you to configure various aspects of VAPI AI assistants including voicemail detection, keypad input, call duration, and timing settings.

## Base URL

```
https://your-domain.com/api/v1/vapi
```

## Authentication

All endpoints require authentication using JWT tokens in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Frontend Interface

The API expects and returns data in the following `CallSettings` interface format:

```typescript
export interface CallSettings {
  voicemailDetection: {
    enabled: boolean;
    action: "hang-up" | "leave-message";
  };
  userKeypadInput: {
    enabled: boolean;
    timeout: number;
    terminationKey: string;
    digitLimit: number;
  };
  endCallOnSilence: {
    enabled: boolean;
    duration: number;
  };
  maxCallDuration: number;
  pauseBeforeSpeaking: number;
  ringDuration: number;
}
```

## VAPI API Schema Mapping

The API automatically maps between the frontend interface and the actual VAPI API schema:

- **Frontend**: `voicemailDetection.enabled` → **VAPI**: `voicemailDetection` object or `null`
- **Frontend**: `userKeypadInput.timeout` → **VAPI**: `keypadInputPlan.timeoutSeconds`
- **Frontend**: `endCallOnSilence.duration` → **VAPI**: `stopSpeakingPlan.backoffSeconds`
- **Frontend**: `pauseBeforeSpeaking` → **VAPI**: `startSpeakingPlan.waitSeconds`
- **Frontend**: `ringDuration` → **VAPI**: `transportConfigurations[].timeout`

## Endpoints

### 1. Update All Call Settings

**Endpoint:** `PATCH /assistant/:assistantId/settings`

**Description:** Update all VAPI assistant call settings at once.

**Parameters:**

- `assistantId` (path): The VAPI assistant ID

**Request Body:**

```json
{
  "voicemailDetection": {
    "enabled": true,
    "action": "hang-up"
  },
  "userKeypadInput": {
    "enabled": true,
    "timeout": 2.5,
    "terminationKey": "#",
    "digitLimit": 1
  },
  "endCallOnSilence": {
    "enabled": true,
    "duration": 5
  },
  "maxCallDuration": 1,
  "pauseBeforeSpeaking": 0.5,
  "ringDuration": 30,
  "firstMessage": "Hello! How can I help you?",
  "firstMessageMode": "assistant-speaks-first",
  "backgroundSound": "office"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "assistant_id",
    "name": "Assistant Name",
    "voicemailDetection": {
      "beepMaxAwaitSeconds": 30,
      "provider": "google",
      "backoffPlan": {
        "startAtSeconds": 5,
        "frequencySeconds": 5,
        "maxRetries": 6
      },
      "type": "audio"
    },
    "keypadInputPlan": {
      "enabled": true,
      "timeoutSeconds": 2.5,
      "delimiters": "#"
    },
    "stopSpeakingPlan": {
      "numWords": 0,
      "voiceSeconds": 0.2,
      "backoffSeconds": 5
    },
    "maxDurationSeconds": 3600,
    "startSpeakingPlan": {
      "waitSeconds": 0.5,
      "smartEndpointingPlan": {
        "provider": "vapi"
      },
      "smartEndpointingEnabled": false
    },
    "transportConfigurations": [
      {
        "provider": "twilio",
        "timeout": 30,
        "record": false,
        "recordingChannels": "mono"
      }
    ]
  },
  "message": "VAPI assistant call settings updated successfully",
  "updatedSettings": {
    "voicemailDetection": {
      "beepMaxAwaitSeconds": 30,
      "provider": "google",
      "type": "audio"
    }
  }
}
```

### 2. Get Current Call Settings

**Endpoint:** `GET /assistant/:assistantId/settings`

**Description:** Retrieve the current call settings for a VAPI assistant.

**Parameters:**

- `assistantId` (path): The VAPI assistant ID

**Response:**

```json
{
  "success": true,
  "data": {
    "voicemailDetection": {
      "enabled": true,
      "action": "hang-up"
    },
    "userKeypadInput": {
      "enabled": true,
      "timeout": 2.5,
      "terminationKey": "#",
      "digitLimit": 1
    },
    "endCallOnSilence": {
      "enabled": true,
      "duration": 5
    },
    "maxCallDuration": 1,
    "pauseBeforeSpeaking": 0.5,
    "ringDuration": 30
  },
  "message": "VAPI assistant call settings retrieved successfully"
}
```

### 3. Update Specific Setting Category

**Endpoint:** `PATCH /assistant/:assistantId/settings/:category`

**Description:** Update a specific category of VAPI assistant settings.

**Parameters:**

- `assistantId` (path): The VAPI assistant ID
- `category` (path): The setting category (`voicemail`, `keypad`, `silence`, `timing`)

**Supported Categories:**

#### Voicemail Settings (`voicemail`)

```json
{
  "enabled": true,
  "action": "hang-up"
}
```

#### Keypad Input Settings (`keypad`)

```json
{
  "enabled": true,
  "timeout": 2.5,
  "terminationKey": "#",
  "digitLimit": 1
}
```

#### Silence Detection Settings (`silence`)

```json
{
  "enabled": true,
  "duration": 5
}
```

#### Timing Settings (`timing`)

```json
{
  "maxCallDuration": 2,
  "pauseBeforeSpeaking": 1.0,
  "ringDuration": 45
}
```

## Configuration Options

### Voicemail Detection

- **enabled**: Enable/disable voicemail detection
- **action**: Action when voicemail is detected (`hang-up`, `leave-message`)

### Keypad Input Detection

- **enabled**: Enable/disable keypad input detection
- **timeout**: Timeout in seconds (default: 2.5s)
- **terminationKey**: Key to terminate input (default: "#")
- **digitLimit**: Maximum number of digits to collect (default: 1)

### End Call on Silence

- **enabled**: Enable/disable ending calls on silence
- **duration**: Silence threshold in seconds (default: 5s)

### Call Duration & Timing

- **maxCallDuration**: Maximum call duration in hours (default: 0.17 hours = 10 minutes)
- **pauseBeforeSpeaking**: Pause before assistant speaks in seconds (default: 0s)
- **ringDuration**: Ring duration in seconds (default: 30s)

### Additional Settings

- **firstMessage**: First message the assistant says
- **firstMessageMode**: Mode for first message (`assistant-speaks-first`, `assistant-waits-for-user`)
- **backgroundSound**: Background sound during calls (`office`, `off`, custom URL)

## Error Responses

### Bad Request (400)

```json
{
  "success": false,
  "message": "Assistant ID is required"
}
```

### Invalid Category (400)

```json
{
  "success": false,
  "message": "Invalid category. Supported categories: voicemail, keypad, silence, timing"
}
```

### Internal Server Error (500)

```json
{
  "success": false,
  "message": "Failed to update VAPI assistant call settings",
  "error": "Error details"
}
```

## Usage Examples

### cURL Examples

#### Update All Settings

```bash
curl -X PATCH \
  "https://your-domain.com/api/v1/vapi/assistant/assistant_id/settings" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "voicemailDetection": {
      "enabled": true,
      "action": "hang-up"
    },
    "userKeypadInput": {
      "enabled": true,
      "timeout": 2.5,
      "terminationKey": "#",
      "digitLimit": 1
    },
    "endCallOnSilence": {
      "enabled": true,
      "duration": 5
    },
    "maxCallDuration": 1,
    "ringDuration": 30
  }'
```

#### Get Current Settings

```bash
curl -X GET \
  "https://your-domain.com/api/v1/vapi/assistant/assistant_id/settings" \
  -H "Authorization: Bearer your_jwt_token"
```

#### Update Specific Category

```bash
curl -X PATCH \
  "https://your-domain.com/api/v1/vapi/assistant/assistant_id/settings/voicemail" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "action": "hang-up"
  }'
```

### JavaScript Examples

#### Update All Settings

```javascript
const updateSettings = async (assistantId, settings) => {
  try {
    const response = await fetch(
      `https://your-domain.com/api/v1/vapi/assistant/${assistantId}/settings`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating settings:", error);
  }
};

// Usage - Use the CallSettings interface format
const settings = {
  voicemailDetection: {
    enabled: true,
    action: "hang-up"
  },
  userKeypadInput: {
    enabled: true,
    timeout: 2.5,
    terminationKey: "#",
    digitLimit: 1
  },
  endCallOnSilence: {
    enabled: true,
    duration: 5
  },
  maxCallDuration: 2
};

updateSettings("assistant_id", settings);
```

#### Get Current Settings

```javascript
const getSettings = async (assistantId) => {
  try {
    const response = await fetch(
      `https://your-domain.com/api/v1/vapi/assistant/${assistantId}/settings`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error getting settings:", error);
  }
};
```

## Testing

Use the provided test files to test all endpoints:

### Simple Test (Recommended)

```bash
# Set environment variables
export API_TOKEN="your_jwt_token"
export VAPI_ASSISTANT_ID="your_assistant_id"
export SERVER_URL="https://your-domain.com"

# Run simple tests
node examples/test-vapi-settings-simple.js
```

### Full Test Suite

```bash
# Run full test suite
node examples/test-vapi-settings.js
```

## Best Practices

1. **Use the CallSettings Interface**: Always structure your requests according to the defined interface
2. **Proper Data Types**: Ensure all values match the expected types (boolean, number, string)
3. **Complete Objects**: When updating nested objects, provide all required properties
4. **Test Incrementally**: Test one setting at a time to identify any issues
5. **Check VAPI Logs**: Monitor VAPI API responses for validation errors

## Notes

- The API automatically maps between frontend interface and VAPI API schema
- All time values are converted appropriately between frontend (seconds) and VAPI API
- Duration values are converted between hours (frontend) and seconds (VAPI API)
- Invalid assistant IDs will return appropriate error responses
- All endpoints require valid JWT authentication
- Settings are applied immediately to the VAPI assistant

## Related Documentation

- [VAPI API Reference](https://docs.vapi.ai/api-reference/assistants/update)
- [VAPI Service Implementation](../src/services/vapi.service.js)
- [VAPI Settings Controller](../src/controllers/vapiSettings.controller.js)
