# AI Service Pricing Calculator API

## Endpoint

`POST /api/v1/services/ai-calculate-pricing`

## Description

AI-powered service pricing calculator that analyzes customer requests and ticket information to provide intelligent pricing recommendations using OpenAI.

## Authentication

- **Required**: JWT token in Authorization header
- **Organization**: User must belong to an organization

## Request Body

```json
{
  "userPrompt": "Customer has a flat tire on highway 101, needs roadside assistance immediately.",
  "ticketId": "64a7b8c9d123456789abcdef"
}
```

## Response

```json
{
  "success": true,
  "ticketId": "64a7b8c9d123456789abcdef",
  "userPrompt": "Customer has a flat tire...",
  "aiResponse": "**SERVICE PRICING ANALYSIS**\n\n**Recommended Services:**\n1. Flat Tire Service - $75.00...",
  "contextInfo": {
    "organizationName": "ABC Roadside",
    "vehicleInfo": {...},
    "availableServices": 8,
    "towingRatesAvailable": 3
  }
}
```

## How It Works

1. Fetches ticket information and organization services
2. Sends comprehensive context to OpenAI with pricing rules
3. AI analyzes situation and recommends appropriate services
4. Returns detailed pricing breakdown with reasoning

## Example Usage

```bash
curl -X POST "/api/v1/services/ai-calculate-pricing" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userPrompt": "Emergency flat tire on highway",
    "ticketId": "64a7b8c9d123456789abcdef"
  }'
```

## Benefits

- Smart service selection based on context
- Follows organization pricing rules
- Considers weather, location, urgency
- Provides detailed explanations
- Handles towing calculations automatically

## Requirements

- OpenAI API key configured
- Valid ticket with complete information
- Organization services set up
- Vehicle classifications for towing rates
