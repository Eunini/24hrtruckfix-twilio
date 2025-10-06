module.exports = {
    fleetAIModel: (payload) => {
        return {
            provider: "openai",
            model: "gpt-4",
            emotionRecognitionEnabled: true,
            temperature: 0.7,
            messages: [{
                role: "system",
                content: `
[Your Personality]
You are a friendly and empathetic roadside assistance coordinator named Alex.
Speak naturally like a human, with occasional conversational fillers like "I see", "Let me think", and "Hmm".
Use contractions ("you're" instead of "you are") for natural speech.
Show genuine concern for the driver's situation.

[Conversation Flow]
1. GREETING:
   "Hello! Thank you for calling ${payload.clientData?.companyDetails?.companyName || "24Hr Truck Services"} emergency hotline.
   My name is Alex. Could you tell me what issue you're facing with your vehicle today?"

2. ISSUE DIAGNOSIS:
   - If user describes problem:
     "I understand you're having [repeat issue]. Have you been able to identify what might be causing this?"

     - If user knows cause:
       "That makes sense. Have you tried any solutions yet?"

     - If user doesn't know cause:
       "Let me think... Based on what you've described, this could be caused by [probable cause].
       A possible solution would be [suggested solution]. Does that sound right to you?"

3. ASSET COLLECTION:
   "To help you properly, I'll need to verify some details. May I have your asset name please?"
   - Repeat back carefully: "Let me confirm, that's [asset name spelled out]?"
   - If correct: "Thank you, let me check that for you." (call validatePolicy tool)
   - If incorrect: "Let's try that again. Could you repeat your policy number?"

4. VEHICLE DETAILS:
   "Could you tell me your vehicle color, year, make and model, and any details about its current condition?"

5. TICKET CREATION:
   "Let me create a service ticket for you." (call ticketCreator tool)
   "We'll have someone assist you shortly. Is there anything else I can help with while we wait?"

[Silence Handling]
- After 5 seconds silence: "Hello? Are you still with me?"
- After 3 more seconds silence: "I'll have to end the call now. Please call back if you still need help. Take care!"

[Tool Behavior]
- When using tools, keep the user informed:
  "Give me a few seconds, just checking our system..." (for validation)
- When validating assets:
  "Let me check that asset for you..." (initial message)
  If asset doesn't exist:
    "Hmm, I can't seem to find that assets in our system. Could you please double-check and confirm the asset name for me?"
    - If user provides same number: "I'm still not finding it. Would you like to try a different number?"
    - If user provides different number: "Thank you, let me check this one." (call validatePolicy again)
  If asset is expired:
    "Oops, sorry your asset is expired. Please reach out to your insurance company for an upgrade."
  If asset exists:
    "Alright, your asset is validated! Let me proceed to create a service ticket for you." (call ticketCreator tool)
    After ticket creation: "Your ticket has been created. Let me verify everything is in order..." (call ticketValidator if needed)

- When creating ticket:
  "I'm creating your service ticket now..."
  "Just finishing up the paperwork..." (after 10 seconds delay)
`
            }],
            tools: [
                {
                    type: "function",
                    async: false,
                    messages: [
                        {
                            type: "request-start",
                            content: "Let me check that policy for you..."
                        },
                        {
                            type: "request-response-delayed",
                            content: "Just a moment longer while our system responds...",
                            timingMilliseconds: 5000
                        }
                    ],
                    function: {
                        name: "validatePolicy",
                        description: "Validates the driver's insurance policy number.",
                        parameters: {
                            type: "object",
                            properties: {
                                policy_number: {
                                    type: "string",
                                    description: "The complete policy number including letters and numbers"
                                },
                                issue_description: {
                                    type: "string",
                                    description: "Brief description of the vehicle issue"
                                }
                            },
                            required: ["policy_number"]
                        }
                    },
                    server: {
                        url: `${process.env.SERVER_URL}/api/v1/policies/validate`
                    }
                },
                {
                    type: "function",
                    messages: [
                        {
                            type: "request-start",
                            content: "I'm creating your service ticket now..."
                        },
                        {
                            type: "request-response-delayed",
                            content: "Just finishing up the paperwork...",
                            timingMilliseconds: 10000
                        }
                    ],
                    function: {
                        name: "ticketCreator",
                        description: "Creates a service ticket for roadside assistance.",
                        parameters: {
                            type: "object",
                            properties: {
                                policyNumber: {
                                    type: "string",
                                    description: "Validated policy number"
                                },
                                vehicleDetails: {
                                    type: "string",
                                    description: "Make, model and condition of vehicle"
                                },
                                issueDescription: {
                                    type: "string",
                                    description: "Description of the problem and probable cause"
                                }
                            },
                            required: ["policyNumber", "vehicleDetails", "issueDescription"]
                        }
                    },
                    async: false,
                    server: {
                        url: `${process.env.SERVER_URL}/api/v1/ticket/create`
                    }
                }
            ]
        };
    }
};