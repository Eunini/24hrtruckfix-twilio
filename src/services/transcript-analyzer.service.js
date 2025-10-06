const HubSpotService = require("./hubspot.service"); // Adjust path as needed
const redisDataService = require("./redisData.service");

/**
 * Analyzes transcript with Gemini AI and creates/finds HubSpot contact and creates task
 * @param {string} transcript - The call transcript to analyze
 * @param {Object} geminiModel - The Gemini AI model instance
 * @returns {Object} Result with contact and task data
 */
async function analyzeTranscriptAndCreateHubSpotRecords(
  transcript,
  geminiModel,
  callId = "",
  structuredData
) {
  try {
    // Initialize HubSpot service
    const hubspot = new HubSpotService();

    // Define the schema for Gemini to extract
    const schema = `{
      "customer": {
        "email": "string",
        "firstName": "string", 
        "lastName": "string",
        "phone": "string",
        "company": "string"
      },
      "task": {
        "subject": "string",
        "body": "string", 
        "priority": "string", // HIGH, MEDIUM, LOW
        "dueDate": "string", // YYYY-MM-DD format
        "status": "string" // NOT_STARTED, IN_PROGRESS, COMPLETED
      }
    }`;

    // Create the prompt for Gemini
    const prompt = `
    You are an AI assistant tasked with extracting customer and task information from call transcripts for CRM purposes.
    
    Extract the following information from the transcript and format it as a JSON object:
    
    For customer data:
    - Extract email, firstName, lastName, phone, company if mentioned
    - If information is not available, use null
    
    For task data:
    - Create a relevant follow-up task based on the conversation
    - Set appropriate priority (HIGH, MEDIUM, LOW)
    - Set a reasonable due date (within next 7 days)
    - Set status to "NOT_STARTED"
    - Create meaningful subject and body based on conversation context
    
    JSON Schema:
    ${schema}
    
    Transcript:
    ${typeof transcript === "object" ? JSON.stringify(transcript) : transcript}
    
    Respond ONLY with the JSON object, no additional text.
    `;

    let extractedData = null;

    const redisCacheData = await redisDataService.getData(callId);

    console.log(redisCacheData);
    if (structuredData) {
      // If structured data is provided, use it
      console.log("Using provided structured data:", structuredData);
      extractedData = {
        customer: {
          email: structuredData.email || null,
          firstName: structuredData.firstName || null,
          lastName: structuredData.lastName || null,
          phone: structuredData.phone || null,
          company: structuredData.company || null,
        },
        task: {
          subject: structuredData.subject || null,
          body: structuredData.body || null,
          priority: structuredData.priority || null,
          dueDate: structuredData.dueDate || null,
          status: structuredData.status || null,
        },
      };
    } else {
      // Generate content with Gemini
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      extractedData = JSON.parse(jsonStr);
    }

    console.log("Extracted data:", extractedData);

    let contact = null;
    let contactId = null;
    let contactCreated = false;
    let task = null;

    // Check if we have customer data to work with
    if (extractedData.customer && extractedData.customer.email) {
      try {
        // First, try to get existing contact by email
        console.log(
          "Searching for existing contact with email:",
          extractedData.customer.email
        );

        // Try to create contact first and handle duplicate error
        try {
          contact = await hubspot.createContact({
            email: redisCacheData?.email || extractedData.customer.email,
            firstName: extractedData.customer.firstName,
            lastName: extractedData.customer.lastName,
            phone: redisCacheData?.phoneNumber || extractedData.customer.phone,
            company: extractedData.customer.company,
          });

          contactId = contact.id;
          contactCreated = true;
          console.log("New contact created with ID:", contactId);
        } catch (createError) {
          // Handle contact already exists error
          console.log(
            "Contact creation failed, checking if contact exists:",
            createError.message
          );

          // Check if it's a conflict error indicating contact already exists
          if (
            createError.message.includes("Contact already exists") ||
            createError.message.includes("CONFLICT") ||
            createError.status === "error" ||
            (createError.response && createError.response.status === 409)
          ) {
            console.log(
              "Contact already exists, extracting existing contact ID"
            );

            // Extract contact ID from error message
            const idMatch = createError.message.match(/Existing ID:\s*(\d+)/);
            if (idMatch) {
              contactId = idMatch[1];
              console.log(
                "Found existing contact ID from error message:",
                contactId
              );
              contact = {
                id: contactId,
                email: redisCacheData?.email || extractedData.customer.email,
              };
              contactCreated = false;
            } else {
              // Try to extract from error response data
              if (createError.response?.data?.existingObjectId) {
                contactId = createError.response.data.existingObjectId;
                console.log(
                  "Found existing contact ID from response data:",
                  contactId
                );

                contact = {
                  id: contactId,
                  email: redisCacheData?.email || extractedData.customer.email,
                };
                contactCreated = false;
              } else {
                console.error(
                  "Could not extract contact ID from error response"
                );
                throw new Error(
                  "Contact exists but could not retrieve contact ID"
                );
              }
            }
          } else {
            console.error(
              "Unexpected error creating contact:",
              createError.message
            );
            throw createError;
          }
        }
      } catch (error) {
        console.error("Error handling contact:", error.message);
        throw error;
      }
    }

    // Create task if we have task data and a contact ID
    if (extractedData.task && extractedData.task.subject && contactId) {
      try {
        const taskData = {
          subject: extractedData.task.subject,
          body: extractedData.task.body || "Follow up based on call transcript",
          status: extractedData.task.status || "NOT_STARTED",
          priority: extractedData.task.priority || "MEDIUM",
          dueDate: getDefaultDueDate(),
          contactId: contactId, // Use the contact ID we found/created
        };

        task = await hubspot.createTask(taskData);
        console.log(
          "Task created with ID:",
          task.id,
          "associated with contact:",
          contactId
        );
      } catch (error) {
        console.error("Error creating task:", error.message);
        throw error;
      }
    }

    // disabled  for now till when need arrise
    // else if (!contactId) {
    //   console.log(
    //     "No contact ID available, task will be created without contact association"
    //   );

    //   // Create task without contact association if no contact ID
    //   if (extractedData.task && extractedData.task.subject) {
    //     const taskData = {
    //       subject: extractedData.task.subject,
    //       body: extractedData.task.body || "Follow up based on call transcript",
    //       status: extractedData.task.status || "NOT_STARTED",
    //       priority: extractedData.task.priority || "MEDIUM",
    //       dueDate: extractedData.task.dueDate || getDefaultDueDate(),
    //     };

    //     task = await hubspot.createTask(taskData);
    //     console.log("Task created without contact association:", task.id);
    //   }
    // }

    return {
      success: true,
      extractedData,
      contact: contact
        ? {
            id: contactId,
            email: extractedData.customer.email,
            created: contactCreated,
            existed: !contactCreated,
          }
        : null,
      task: task
        ? {
            id: task.id,
            subject: extractedData.task.subject,
            contactId: contactId,
            created: true,
          }
        : null,
    };
  } catch (error) {
    console.error("Error in analyzeTranscriptAndCreateHubSpotRecords:", error);

    return {
      success: false,
      error: error.message,
      extractedData: null,
      contact: null,
      task: null,
    };
  }
}

/**
 * Helper function to get default due date (3 days from now)
 * @returns {string} Date in YYYY-MM-DD format
 */
function getDefaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2); // 2 days from now
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

module.exports = {
  analyzeTranscriptAndCreateHubSpotRecords,
};
