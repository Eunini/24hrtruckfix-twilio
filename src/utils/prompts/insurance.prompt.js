const { multilingualExtension } = require("./general");

module.exports = {
  conciergeAIModel: (payload, customPrompt = null) => {
    return {
      provider: "openai",
      model: "gpt-4",
      emotionRecognitionEnabled: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            customPrompt ||
            `
[Your Task]
You are the AI Concierge Agent for roadside assistance. 
Your role is to handle inbound calls from drivers who need help because their vehicles have broken down. 
You must validate their policy, confirm their vehicle, collect their location (GPS coordinates and address), 
and then create a ticket for a service provider. 
If you cannot validate a caller’s information, or if you reach a failure case, transfer the call to a human agent.

[Driver's Details]
number: ${payload?.vapi?.message?.customer?.number || "Not available"}

[Conversation Flow]

1. Greeting & Confirmation
   - Greet the driver politely.
   - Inform them that they have reached ${
     payload?.clientData?.companyDetails?.companyName || "24Hr Truck Services"
   }'s emergency hotline.
   - Ask if they are currently experiencing an issue with their vehicle.
   - If they say no or are unclear → transfer to a human agent.

2. Policy Number Validation
   - Ask for their policy number.
   - Capture it carefully, letter by letter. Repeat it back to confirm correctness.
   - Call the policy validation tool: 
     {{validatePolicy}}{"policy_number":"[EXACT_POLICY_NUMBER]"}
   - If invalid → Failure Case #1 → explain politely and transfer to human agent.

3. Vehicle Validation
   - If policy is valid, ask: “What vehicle do you have registered with your policy?” 
     (collect year, make, model, color).
   - Compare against system records.
   - If mismatch → Failure Case #2 → explain politely and transfer to human agent.

4. Incident Details Collection (if validations succeed)
   - Ask them to describe the issue with their vehicle.
   - Ask if they want the vehicle **towed** or **fixed on the spot**.
     - If towed → ask for the destination address.
     - If fixed → acknowledge and continue.
   - Ask: “Would you like assistance right now, or would you prefer to schedule it for later?”
     - If **schedule** → collect date & time. Validate that the chosen time is in the future.
       If in the past → ask them to choose again.

5. Location Capture (mandatory)
   - Explain you’ll send them a text with a link to capture their exact location.
   - Send SMS with the location form link.
   - Guide them step by step:
     1. Confirm receipt of SMS.
     2. Click the link.
     3. Allow location access.
     4. Submit location.
   - Once submitted, retrieve both:
     - GPS coordinates (lat/long)
     - Reverse geocoded address  with the tool you have access to.

6. Ticket Creation
   - Compile and submit all collected data via the ticketCreator tool:
     {{ticketCreator}}{
       "caller_name": "...",
       "policy_number": "...",
       "vehicle_details": "...",
       "issue_description": "...",
       "location_coordinates": {"lat":"...", "lng":"..."},
       "address": "...",
       "service_type": "tow|fix",
       "scheduled_time": "..."
     }
   - Confirm ticket created with caller.
   - Ask if they have additional questions.
   - If none, politely end the call.

[Failure & Escalation Cases]
- Failure Case #1: Policy number not found → transfer to human.
- Failure Case #2: Vehicle mismatch → transfer to human.
- Failure Case #3: Caller cannot complete location link → transfer to human.
- Any confusion or unexpected errors → transfer to human.

[Edge Cases for Services]
- Flat Tire → confirm if they have a spare. If no spare → transfer to human.
- Battery Issues → only “jump start” covered. For other issues, offer tow or transfer.
- Lockouts → can be assisted with key replacement.
- Fuel Delivery → covered.
- Any request outside covered services → politely explain coverage uncertainty and offer transfer.

[STRICT PROTOCOL FOR TOOL CALLS]
- When calling validatePolicy: {{validatePolicy}}{"policy_number":"[EXACT_POLICY_NUMBER]"}
- When calling ticketCreator: include ALL information collected.
- When transferring calls: always explain the reason before initiating transfer.
- Do NOT skip validations. Do NOT fake confirmations.

[Important Notes]
- Always be polite, empathetic, and professional.
- Note Before ever transfering the call always ask the caller if they want that or not.
- Don't transfer a call without the knowledge and permission of the caller.
- Always validate that scheduled times are in the future.
- Always capture full vehicle details (year, make, model, color, plate number if possible).
- Ensure final ticket includes BOTH GPS coordinates & reverse-geocoded address.
- Ask for confirmation before any major step (transfer, ticket creation, scheduling).
- For invalid policies, clearly explain the caller may handle costs directly (self-pay) if allowed by business rules.

${multilingualExtension}

            `,
        },
      ],
      tools: [
        {
          type: "function",
          async: false,
          messages: [
            {
              type: "request-start",
              content: "Let me check that policy for you...",
            },
            {
              type: "request-response-delayed",
              content: "Just a moment longer while our system responds...",
              timingMilliseconds: 5000,
            },
          ],
          function: {
            name: "validatePolicy",
            description: "Validates the driver's insurance policy number.",
            parameters: {
              type: "object",
              properties: {
                policy_number: {
                  type: "string",
                  description:
                    "The complete policy number including letters and numbers",
                },
              },
              required: ["policy_number"],
            },
          },
          server: {
            url: `${process.env.SERVER_URL}/api/v1/webhook/policies/validate`,
          },
        },
        {
          type: "function",
          async: false,
          messages: [
            {
              type: "request-start",
              content:
                "I have your cordinates, let me get the correct address...",
            },
            {
              type: "request-response-delayed",
              content: "Just a moment longer while our system responds...",
              timingMilliseconds: 5000,
            },
          ],
          function: {
            name: "getReverseGeocode",
            description:
              "Gets the reverse geocode for the provided latitude and longitude.",
            parameters: {
              type: "object",
              properties: {
                latitude: {
                  type: "string",
                  description: "The latitude of the location.",
                },
                longitude: {
                  type: "string",
                  description: "The longitude of the location.",
                },
              },
              required: ["latitude", "longitude"],
            },
          },
          server: {
            url: `${process.env.SERVER_URL}/api/v1/webhook/geocode/cordinate`,
          },
        },
        {
          type: "function",
          messages: [
            {
              type: "request-start",
              content: "I'm creating your service ticket now...",
            },
            {
              type: "request-response-delayed",
              content: "Just finishing up the paperwork...",
              timingMilliseconds: 10000,
            },
          ],
          function: {
            name: "ticketCreator",
            description: "Creates a service ticket for roadside assistance.",
            parameters: {
              type: "object",
              properties: {
                policy_number: {
                  type: "string",
                  description: "The validated policy number (if available)",
                },
                customer_name: {
                  type: "string",
                  description:
                    "Customer's full name (required for self-pay customers)",
                },
                customer_phone: {
                  type: "string",
                  description: "Customer's phone number",
                },
                vehicle_make: {
                  type: "string",
                  description: "Make of the vehicle (e.g., Honda, Toyota)",
                },
                vehicle_model: {
                  type: "string",
                  description: "Model of the vehicle (e.g., Camry, Odyssey)",
                },
                vehicle_color: {
                  type: "string",
                  description: "Color of the vehicle",
                },
                vehicle_year: {
                  type: "string",
                  description: "Year of the vehicle",
                },
                vehicle_type: {
                  type: "string",
                  description: "Type of vehicle (e.g., sedan, truck, SUV)",
                },
                license_plate: {
                  type: "string",
                  description:
                    "Vehicle license plate number (required for self-pay)",
                },
                service_type: {
                  type: "string",
                  description:
                    "Type of service needed: 'tow' or 'roadside_repair'",
                  enum: ["tow", "roadside_repair"],
                },
                tow_destination: {
                  type: "string",
                  description:
                    "Full address where vehicle should be towed (if service_type is tow)",
                },
                schedule_time: {
                  type: "string",
                  description:
                    "When service is needed: 'immediate' or specific date/time",
                },
                breakdown_reason: {
                  type: "string",
                  description: "Detailed description of the vehicle issue",
                },
                is_self_pay: {
                  type: "boolean",
                  description:
                    "True if customer is paying out of pocket (invalid policy)",
                },
                policy_valid: {
                  type: "boolean",
                  description: "Whether the policy validation was successful",
                },
                coord: {
                  type: "object",
                  description:
                    "Coordinates of the location where the service is needed",
                  properties: {
                    latitude: {
                      type: "number",
                      description: "Latitude of the location",
                    },
                    longitude: {
                      type: "number",
                      description: "Longitude of the location",
                    },
                  },
                },
                breakdown_address: {
                  type: "object",
                  description:
                    "Address of the location where the vehicle is broken down",
                  properties: {
                    address_line_1: {
                      type: "string",
                      description: "First line of the address",
                    },
                    city: {
                      type: "string",
                      description: "City",
                    },
                    state: {
                      type: "string",
                      description: "State or province",
                    },
                    street: {
                      type: "string",
                      description: "Street address",
                    },
                    zipcode: {
                      type: "string",
                      description: "Postal or ZIP code",
                    },
                  },
                },
              },
              required: ["breakdown_reason", "service_type", "schedule_time"],
            },
          },
          async: false,
          server: {
            url: `${process.env.SERVER_URL}/api/v1/webhook/create-ticket`,
            // url: `https://tidy-tetra-literate.ngrok-free.app/api/v1/webhook/create-ticket`,
          },
        },
        {
          type: "function",
          async: false,
          messages: [
            {
              type: "request-start",
              content: "Searching our knowledge base...",
            },
            {
              type: "request-response-delayed",
              content: "Just a moment while I find the information...",
              timingMilliseconds: 3000,
            },
          ],
          function: {
            name: "knowledge_base_chat",
            description:
              "Search the organization's knowledge base for relevant information to help answer questions.",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description:
                    "The question or query to search for in the knowledge base",
                },
              },
              required: ["message"],
            },
          },
          server: {
            url: `${process.env.SERVER_URL}/api/v1/webhook/knowledge-base/${
              payload?.organization_id || "test-org-123"
            }/chat`,
          },
        },
        ...(payload?.clientData?.aiConfig?.metadata?.transferNumber
          ? [
              {
                type: "transferCall",
                function: {
                  name: "transfer_call_tool",
                  parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                  },
                },
                messages: [
                  {
                    type: "request-start",
                    blocking: false,
                  },
                ],
                destinations: [
                  {
                    type: "number",
                    number:
                      payload?.clientData?.aiConfig?.metadata.transferNumber,
                    message:
                      payload?.clientData?.aiConfig?.metadata
                        ?.transferMessage || "hey",
                    transferPlan: {
                      mode: "warm-transfer-wait-for-operator-to-speak-first-and-then-say-summary",
                      sipVerb: "refer",
                      timeout: 5,
                      summaryPlan: {
                        enabled: true,
                        messages: [
                          {
                            role: "system",
                            content:
                              String(
                                payload?.clientData?.aiConfig?.metadata
                                  ?.summaryContent
                              ) +
                              " Please provide a summary of the call to the receiving agent.",
                          },
                          {
                            role: "user",
                            content:
                              "Here is the transcript of the call you are about to Transfer:\n\n{{transcript}}\n\n",
                          },
                        ],
                        timeoutSeconds: 5,
                        useAssistantLlm: true,
                      },
                    },
                    numberE164CheckEnabled: true,
                  },
                ],
              },
            ]
          : []),
        {
          type: "function",
          async: false,
          messages: [
            {
              type: "request-start",
              content: "Let me send that sms to you...",
            },
            {
              type: "request-response-delayed",
              content: "Just a moment longer while our system responds...",
              timingMilliseconds: 5000,
            },
          ],
          function: {
            name: "sendSms",
            description:
              "Use this to send an SMS to the driver to get their location and all.",
            parameters: {
              type: "object",
              properties: {},
            },
          },
          server: {
            url: `${process.env.SERVER_URL}/api/v1/webhook/send/sms`,
          },
        },
      ],
    };
  },
};
