const axios = require("axios");
const { Tracking, Ticket, Onboarding, AIConfig } = require("../models");

/**
 * Cron Job Service for handling scheduled tasks via API endpoints
 */
class CronJobService {
  /**
   * Process tickets needing next batch of mechanic calls
   * This replaces the cron job functionality with an API endpoint
   * @returns {Promise<Object>} Processing result
   */
  async processTicketBatches() {
    const startTime = Date.now();
    let processedTickets = 0;
    let errors = [];

    try {
      console.log("🔄 Starting ticket batch processing...");

      // Find tickets that need next batch processing
      const trackingDocs = await Tracking.find({
        $expr: { $lt: ["$calledMechanics", "$totalMechanics"] },
        callFinished: { $exists: false }, // Only process active calls
      });

      console.log(`📋 Found ${trackingDocs.length} tickets to process`);

      for (const tracking of trackingDocs) {
        try {
          const result = await this.processTicketBatch(tracking);
          if (result.processed) {
            processedTickets++;
          }

          if (result.error) {
            errors.push({
              ticketId: tracking.ticketId,
              error: result.error,
            });
          }
        } catch (error) {
          console.error(
            `❌ Error processing ticket ${tracking.ticketId}:`,
            error.message
          );
          errors.push({
            ticketId: tracking.ticketId,
            error: error.message,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ Batch processing completed in ${processingTime}ms`);
      console.log(
        `📊 Processed: ${processedTickets}, Errors: ${errors.length}`
      );

      return {
        success: true,
        processingTime: `${processingTime}ms`,
        totalFound: trackingDocs.length,
        processed: processedTickets,
        errors: errors.length,
        errorDetails: errors,
      };
    } catch (error) {
      console.error("❌ Batch processing failed:", error);
      return {
        success: false,
        error: error.message,
        processingTime: `${Date.now() - startTime}ms`,
        processed: processedTickets,
        errors: errors.length + 1,
      };
    }
  }

  /**
   * Process a single ticket batch
   * @param {Object} tracking - Tracking document
   * @returns {Promise<Object>} Processing result
   */
  async processTicketBatch(tracking) {
    try {
      const { ticketId, allMechanics, batchIndex, foundInterestTime } =
        tracking;

      console.log(`🎫 Processing ticket ${ticketId}, batch ${batchIndex}`);

      // Check if 10 minutes have elapsed since interest was found
      if (foundInterestTime) {
        const elapsedMinutes =
          (new Date() - new Date(foundInterestTime)) / (1000 * 60);
        if (elapsedMinutes > 10) {
          console.log(
            `⏰ Skipping ticket ${ticketId} - 10 minute window expired (${elapsedMinutes.toFixed(
              1
            )} minutes)`
          );

          await Tracking.updateOne(
            { ticketId },
            { $set: { callFinished: new Date() } }
          );

          return {
            processed: false,
            skipped: true,
            reason: "Time window expired",
          };
        }
      }

      // Get next batch of mechanics
      const nextBatchStart = batchIndex * 10;
      const nextBatch = allMechanics.slice(nextBatchStart, nextBatchStart + 10);

      if (nextBatch.length === 0) {
        console.log(`📭 No more mechanics to call for ticket ${ticketId}`);
        await Tracking.updateOne(
          { ticketId },
          { $set: { callFinished: new Date() } }
        );

        return {
          processed: false,
          completed: true,
          reason: "No more mechanics available",
        };
      }

      console.log(
        `📞 Calling ${nextBatch.length} mechanics for ticket ${ticketId}`
      );

      // Call mechanics in parallel
      const callPromises = nextBatch.map((mechanic) =>
        this.callMechanic(mechanic, ticketId)
      );
      const callResults = await Promise.allSettled(callPromises);

      // Count successful calls
      const successfulCalls = callResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failedCalls = callResults.filter(
        (result) => result.status === "rejected"
      ).length;

      console.log(
        `📊 Ticket ${ticketId}: ${successfulCalls} successful calls, ${failedCalls} failed calls`
      );

      // Update tracking document
      await Tracking.updateOne(
        { ticketId },
        {
          $inc: {
            calledMechanics: nextBatch.length,
            batchIndex: 1,
          },
          $set: {
            callFinished: new Date(),
            lastProcessedAt: new Date(),
          },
        }
      );

      return {
        processed: true,
        mechanicsCalled: nextBatch.length,
        successfulCalls,
        failedCalls,
        batchIndex: batchIndex + 1,
      };
    } catch (error) {
      console.error(
        `❌ Error processing batch for ticket ${tracking.ticketId}:`,
        error.message
      );
      return {
        processed: false,
        error: error.message,
      };
    }
  }

  /**
   * Call a single mechanic using VAPI
   * @param {Object} mechanic - Mechanic data
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>} Call result
   */
  async callMechanic(mechanic, ticketId) {
    try {
      console.log(
        `📞 Calling mechanic ${mechanic.displayName?.text} for ticket ${ticketId}`
      );

      // Fetch ticket details and related data
      const [ticketDoc, aiConfig, companyDetails] =
        await this.getTicketAndRelatedData(ticketId);

      if (!ticketDoc) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      // Determine if this is an experienced mechanic
      const isExperienced = mechanic.hasOnboarded || false;

      // Build the VAPI payload
      const vapiPayload = await this.buildVAPIPayload(
        mechanic,
        ticketDoc,
        isExperienced,
        companyDetails,
        aiConfig
      );

      // Make the VAPI call
      const response = await axios.post(
        "https://api.vapi.ai/call/phone",
        vapiPayload,
        {
          timeout: 30000, // 30 second timeout
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              isExperienced
                ? "9a8d1c07-e26f-4106-8958-3b4c71b5c90f"
                : process.env.VAPI_API_KEY
            }`,
          },
        }
      );

      console.log(
        `✅ VAPI call initiated for mechanic ${
          mechanic.displayName?.text
        } - Call ID: ${response.data?.id || "N/A"}`
      );

      return {
        success: true,
        mechanic: mechanic.displayName?.text,
        callId: response.data?.id,
        status: response.status,
        endpoint: isExperienced ? "experienced" : "standard",
        vapiResponse: response.data,
      };
    } catch (error) {
      console.error(
        `❌ Error calling mechanic ${mechanic.displayName?.text}:`,
        error.message
      );

      return {
        success: false,
        mechanic: mechanic.displayName?.text,
        error: error.message,
        endpoint: mechanic.hasOnboarded ? "experienced" : "standard",
      };
    }
  }

  /**
   * Get ticket details and related data
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Array>} [ticketDoc, aiConfig, companyDetails]
   */
  async getTicketAndRelatedData(ticketId) {
    try {
      // Fetch ticket document
      const ticketDoc = await Ticket.findById(ticketId);
      if (!ticketDoc) {
        return [null, null, null];
      }

      // Fetch AI config and company details
      const [aiConfig, onboardingDoc] = await Promise.all([
        AIConfig.findOne({ client_id: ticketDoc.organization_id }),
        Onboarding.findOne({ user_id: ticketDoc.organization_id }),
      ]);

      const companyDetails = onboardingDoc?.companyDetails || {};

      return [ticketDoc, aiConfig, companyDetails];
    } catch (error) {
      console.error("Error fetching ticket and related data:", error);
      return [null, null, null];
    }
  }

  /**
   * Build VAPI payload for mechanic call
   * @param {Object} mechanic - Mechanic data
   * @param {Object} ticketDoc - Ticket document
   * @param {boolean} isExperienced - Whether mechanic is experienced
   * @param {Object} companyDetails - Company details
   * @param {Object} aiConfig - AI configuration
   * @returns {Object} VAPI payload
   */
  async buildVAPIPayload(
    mechanic,
    ticketDoc,
    isExperienced,
    companyDetails,
    aiConfig
  ) {
    const mechanicName =
      mechanic.displayName?.text || mechanic.firstName || "mechanic";
    const mechanicNumber = mechanic.internationalPhoneNumber;
    const distance = mechanic.distance || "";
    const vehicleOwnerNumber = `${ticketDoc.cell_country_code?.dialCode || ""}${
      ticketDoc.current_cell_number || ""
    }`;
    const breakdownAddress =
      ticketDoc.breakdown_address || mechanic.formattedAddress || "";
    const towDestination = ticketDoc.tow_destination?.address_line_1 || "";
    const companyName = companyDetails.companyName || "24Hr Truck Services";

    // Generate system prompt based on mechanic type and whether towing is needed
    const systemPrompt = this.generateSystemPrompt({
      isExperienced,
      hasTowDestination: !!towDestination,
      mechanicName,
      distance,
      vehicleColor: ticketDoc.vehicle_color,
      vehicleMake: ticketDoc.vehicle_make,
      vehicleModel: ticketDoc.vehicle_model,
      vehicleYear: ticketDoc.vehicle_year,
      licensePlate: ticketDoc.license_plate_no,
      breakdownReason: ticketDoc.breakdown_reason_text,
      breakdownAddress,
      towDestination,
      companyName,
      jobId: ticketDoc._id.toString(),
      vehicleOwnerNumber,
      mechanicNumber,
      labourRate: mechanic.labour || "",
    });

    // Base payload structure
    const payload = {
      assistant: {
        model: {
          model: "gpt-4o",
          systemPrompt: systemPrompt,
          temperature: 0.7,
          provider: "openai",
          functions: [
            {
              name: "sendSms",
              description: "This is used to send an sms to a specific mechanic",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description:
                      "all the information about the Vehicle color, break down location or address, distance from the break down location, link to fill the form model, make, year, plate number, break down issue, and any other relevant issue, also the Vehicle owner's number this should be in a sentence format not key value pair format.",
                  },
                  number: {
                    type: "string",
                    description:
                      "The mechanics number that the sms would be sent to.",
                  },
                  name: {
                    type: "string",
                    description: "The mechanics name or business name.",
                  },
                  id: {
                    type: "string",
                    description: "The job id to send to the mechanic.",
                  },
                },
              },
              serverUrl: isExperienced
                ? "https://kklayn.buildship.run/send-sms-exp"
                : "https://kklayn.buildship.run/send-sms",
            },
            {
              name: "checkJobStatus",
              description:
                "This is used to check if the job has been taken or not",
              parameters: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "This is the id of the job to be checked.",
                  },
                },
              },
              serverUrl: "https://kklayn.buildship.run/get-truck-detail",
            },
          ],
        },
        endCallFunctionEnabled: true,
        firstMessage: isExperienced
          ? `Hello am i unto ${mechanicName}, from ${mechanicName}?`
          : `Hello am i unto ${mechanicName}`,
      },
      phoneNumber: {
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
        twilioPhoneNumber: isExperienced
          ? process.env.TWILIO_PHONE_NUMBER
          : aiConfig?.number || process.env.TWILIO_PHONE_NUMBER,
      },
      assistantId: isExperienced
        ? "d3a55652-199e-436a-9dc8-9651bba4f462"
        : aiConfig?.assistant_id || "d3a55652-199e-436a-9dc8-9651bba4f462",
      customer: {
        name: mechanicName,
        number: isExperienced ? "+19145200493" : mechanicNumber,
      },
    };

    return payload;
  }

  /**
   * Generate system prompt based on parameters
   * @param {Object} params - Parameters for prompt generation
   * @returns {string} Generated system prompt
   */
  generateSystemPrompt(params) {
    const {
      isExperienced,
      hasTowDestination,
      mechanicName,
      distance,
      vehicleColor,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      licensePlate,
      breakdownReason,
      breakdownAddress,
      towDestination,
      companyName,
      jobId,
      vehicleOwnerNumber,
      mechanicNumber,
      labourRate,
    } = params;

    if (isExperienced) {
      // Experienced mechanic prompt
      return hasTowDestination
        ? // Experienced with towing
          `Ava - AI Voice Agent Call Script for Mechanics Previously Contacted

Objective: Re-engage with a mechanic who has been contacted previously, offering them a new job opportunity while considering their preferences and previous interactions.

This job requires towing services

Introduction & Reference to Previous Interaction

"Hi [${mechanicName}], this is Ava from 24hr Truck Services, calling on behalf of BerkleyOne Roadside. We've worked with you before, and I wanted to check if you'd be available to assist with a new vehicle breakdown nearby."
"The breakdown is [${distance}] miles from your location, based on our last contact. Are you currently available to take a look?"

Job Description

If the mechanic shows interest, provide details:
"The vehicle is a [${vehicleColor}] [${vehicleMake}] [${vehicleModel}] ([${vehicleYear}]), which has broken down due to [${breakdownReason}]."
"It is located at [${breakdownAddress}]."

Tow destination
The vehicle needs to be towed to: ${towDestination}
Are you able to tow to this location?

Payment & Service Considerations
If they ask about payment: "We understand your hourly rate is $[${labourRate} per Hr]. BerkleyOne Insurance covers the payment for services provided."

Job Assignment & Confirmation
"If you're interested in taking this job, I'll check the status and make sure the job hasn't been assigned to another mechanic." The job id to check the job status is ${jobId}

If they say it is a problem they can fix. Tell them that the vehicle is covered under BerkleyOne Insurance, and they would handle all the bills. Then ask them if they will be willing to take the job. 

If they agree to take the job, call the checkJobStatus to know if the job is assigned already or not, this is the job id: ${jobId}, 
      
If already assigned: "It looks like as we were talking, this job was been assigned to another mechanic. However, I'll put you on a priority list future jobs in your area."

If not assigned: "I will send you an SMS with all the job details, including the customer's contact information. To secure the job, simply reply with 'Y'."

Send the text message to this number ${mechanicNumber}, 

the vehicle owner's number is ${vehicleOwnerNumber},

the break down location is: ${breakdownAddress} 
The tow destination is: ${towDestination}

Follow-up & Updates
"Also, just a quick reminder, please confirm with dispatch once you arrive to help the customer. A text back to this number will be sufficient."

Closing the Call
"Thank you for your time, [${mechanicName}]. We appreciate your cooperation."`
        : // Experienced without towing
          `Ava - AI Voice Agent Call Script for Mechanics Previously Contacted

Objective: Re-engage with a mechanic who has been contacted previously, offering them a new job opportunity while considering their preferences and previous interactions.

Introduction & Reference to Previous Interaction

"Hi [${mechanicName}], this is Ava from 24hr Truck Services, calling on behalf of BerkleyOne Roadside. We've worked with you before, and I wanted to check if you'd be available to assist with a new vehicle breakdown nearby."
"The breakdown is [${distance}] miles from your location, based on our last contact. Are you currently available to take a look?"

Job Description

If the mechanic shows interest, provide details:
"The vehicle is a [${vehicleColor}] [${vehicleMake}] [${vehicleModel}] ([${vehicleYear}]), which has broken down due to [${breakdownReason}]."
"It is located at [${breakdownAddress}]."

Payment & Service Considerations
If they ask about payment: "We understand your hourly rate is $[${labourRate} per Hr]. BerkleyOne Insurance covers the payment for services provided."

Job Assignment & Confirmation
"If you're interested in taking this job, I'll check the status and make sure the job hasn't been assigned to another mechanic." The job id to check the job status is ${jobId}

If they say it is a problem they can fix. Tell them that the vehicle is covered under BerkleyOne Insurance, and they would handle all the bills. Then ask them if they will be willing to take the job. 

If they agree to take the job, call the checkJobStatus to know if the job is assigned already or not, this is the job id: ${jobId}, 
      
If already assigned: "It looks like as we were talking, this job was been assigned to another mechanic. However, I'll put you on a priority list future jobs in your area."

If not assigned: "I will send you an SMS with all the job details, including the customer's contact information. To secure the job, simply reply with 'Y'."

Send the text message to this number ${mechanicNumber}, 

text message content
The text message will contain all the details about the job, including the customer's contact information and any additional vehicle details... 
 
the vehicle owner's number is ${vehicleOwnerNumber}. 

Follow-up & Updates
"Also, just a quick reminder, please confirm with dispatch once you arrive to help the customer. A text back to this number will be sufficient."

Closing the Call
"Thank you for your time, [${mechanicName}]. We appreciate your cooperation."`;
    } else {
      // Regular mechanic prompt
      return hasTowDestination
        ? // Regular with towing
          `Your name is Ava. Your task is to call a mechanic and ask if they are willing to respond to an emergency Vehicle breakdown nearby. Here's the reason the vehicle brokedown: ${breakdownReason}. It broke down at ${breakdownAddress}
It's a ${vehicleColor} colored ${vehicleMake} ${vehicleModel} (${vehicleYear}) the plate number is ${licensePlate}
If asked, you're calling from 24 Hour Truck Rescue.

This job requires towing services

The conversation should follow this flow:
1. Greet the mechanic politely, and inform the mechanic that a Vehicle has broken down nearby ${distance} away from them. The vehicle is in need of a tow. Ask if they'll be willing to take a look at it.

2. If they say they are willing, tell them the tow destination is: ${towDestination}, and ask if they are willing to tow to that destination

3. If they agree. Tell them that the vehicle is covered under BerkleyOne Insurance, and they would handle all the bills. Then ask them if they will be willing to take the job. 

4. If they agree to take the job, call the checkJobStatus to know if the job is assigned already or not, this is the job id: ${jobId}, if the job is not assigned call the SMS function using these details: 
send the text message to this number ${mechanicNumber}, 

the vehicle owner's number is ${vehicleOwnerNumber}, the link to send to the mechanic to fill the form is https://roadrescue24hr.fillout.com/onboarding?ticketID=${jobId},  

The tow destination is: ${towDestination}

then you will send them all the details via an text message. The text message will contain all the details about the job, including the customer's contact information and any additional vehicle details... 

The text message will also come with a link. It is important that they click this link and fill out the form, as this is what secures the job for them. Ask if they understand that. If they have any questions, try to answer their questions, else thank them for their time, and let them know that we'll be expecting their speedy arrival.

If the current status is assigned, then tell the Mechanic that it seems another mechanic has already taken the Job. Tell them that we would still love to have them on file for other jobs in the future. So you would send them as SMS containing details about 24 hour truck, and a link for them to be first priority for other jobs in the area.

As if that is okay by them. If they agree, call the SMS function using these details: 
send the text message to this number ${mechanicNumber}, 
the name of the mechanic or there businessName: ${mechanicName}
Text Message: 24 Hour Truck is a Service that helps broken down Vehicle find mechanics to help them as fast as possible using AI. 

We would love to give you priority for future jobs in your area. Please fill out and submit this form to be on the priority list: https://forms.fillout.com/t/ab9vwf3Kwius

Thank the mechanic for their time and assistance. 

5. If the mechanic says they cannot fix it, thank them for their time and politely end the call.
If you're asked any questions regarding payment or what the compensation for the job would be, tell them that representatives would reach out to them to negotiate the bill. You should also look into your knowledge base and use the provided info to estimate the bill based on the nature of the job, and other factors. Let them know that this is just an estimate.`
        : // Regular without towing
          `Your name is Ava. Your task is to call a mechanic and ask if they are willing to respond to an emergency Vehicle breakdown nearby. Here's the reason the vehicle brokedown: ${breakdownReason}. It broke down at ${breakdownAddress}
It's a ${vehicleColor} colored ${vehicleMake} ${vehicleModel} (${vehicleYear}) the plate number is ${licensePlate}
If asked, you're calling from ${companyName}.

The conversation should follow this flow:
1. Greet the mechanic politely, and inform the mechanic that a Vehicle has broken down nearby ${distance} away from them, and ask if they'll be willing to take a look at it.

2. If they say they are willing, describe the situation of the Vehicle and the type. Ask if it is a problem they can fix. 

3. If they say it is a problem they can fix. Tell them that the vehicle is covered under BerkleyOne Insurance, and they would handle all the bills. Then ask them if they will be willing to take the job. 

4. If they agree to take the job, call the checkJobStatus to know if the job is assigned already or not, this is the job id: ${jobId}, if the job is not assigned call the SMS function using these details: send the text message to this number ${mechanicNumber}, the vehicle owner's number is ${vehicleOwnerNumber}, the link to send to the mechanic to fill the form is https://roadrescue24hr.fillout.com/onboarding?ticketID=${jobId}, then you will send them all the details via a text message. The SMS will contain all the details about the job, including the customer's contact information and any additional vehicle details... 

The text message will also come with a link. It is important that they click this link and fill out the form, as this is what secures the job for them. Ask if they understand that. If they have any questions, try to answer their questions, else thank them for their time, and let them know that we'll be expecting their speedy arrival.

If the current status is assigned, then tell the Mechanic that it seems another mechanic has already taken the Job. Tell them that we would still love to have them on file for other jobs in the future. So you would send them as text message containing details about 24 hour truck, and a link for them to be first priority for other jobs in the area.

As if that is okay by them. If they agree, call the SMS function using these details: 
send the sms to this number ${mechanicNumber}, 
the name of the mechanic or there businessName: ${mechanicName}
The text message Message: 24 Hour Truck is a Service that helps broken down Vehicle find mechanics to help them as fast as possible using AI. 

We would love to give you priority for future jobs in your area. Please fill out and submit this form to be on the priority list: https://forms.fillout.com/t/ab9vwf3Kwius

Thank the mechanic for their time and assistance. 

5. If the mechanic says they cannot fix it, thank them for their time and politely end the call.
If you're asked any questions regarding payment or what the compensation for the job would be, tell them that representatives would reach out to them to negotiate the bill. You should also look into your knowledge base and use the provided info to estimate the bill based on the nature of the job, and other factors. Let them know that this is just an estimate.`;
    }
  }

  /**
   * Get statistics about current tracking status
   * @returns {Promise<Object>} Statistics
   */
  async getTrackingStats() {
    try {
      const [
        totalTracking,
        activeTracking,
        completedTracking,
        expiredTracking,
      ] = await Promise.all([
        Tracking.countDocuments(),
        Tracking.countDocuments({
          $expr: { $lt: ["$calledMechanics", "$totalMechanics"] },
          callFinished: { $exists: false },
        }),
        Tracking.countDocuments({
          callFinished: { $exists: true },
        }),
        Tracking.countDocuments({
          foundInterestTime: {
            $lt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          },
          callFinished: { $exists: false },
        }),
      ]);

      return {
        total: totalTracking,
        active: activeTracking,
        completed: completedTracking,
        expired: expiredTracking,
        pendingExpiration: expiredTracking, // These should be marked as finished
      };
    } catch (error) {
      console.error("❌ Error getting tracking stats:", error);
      throw error;
    }
  }

  /**
   * Clean up expired tracking records
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpiredTracking() {
    try {
      console.log("🧹 Starting cleanup of expired tracking records...");

      const expiredQuery = {
        foundInterestTime: {
          $lt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
        callFinished: { $exists: false },
      };

      const expiredDocs = await Tracking.find(expiredQuery);
      console.log(`📋 Found ${expiredDocs.length} expired tracking records`);

      if (expiredDocs.length === 0) {
        return {
          success: true,
          cleaned: 0,
          message: "No expired records to clean",
        };
      }

      // Mark them as finished
      const result = await Tracking.updateMany(expiredQuery, {
        $set: {
          callFinished: new Date(),
          cleanupReason: "Expired - 10 minute window exceeded",
        },
      });

      console.log(
        `✅ Marked ${result.modifiedCount} expired tracking records as finished`
      );

      return {
        success: true,
        cleaned: result.modifiedCount,
        found: expiredDocs.length,
        message: `Cleaned up ${result.modifiedCount} expired tracking records`,
      };
    } catch (error) {
      console.error("❌ Error cleaning up expired tracking:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Manual trigger for specific ticket processing
   * @param {string} ticketId - Ticket ID to process
   * @returns {Promise<Object>} Processing result
   */
  async processSpecificTicket(ticketId) {
    try {
      console.log(`🎯 Manual processing for ticket: ${ticketId}`);

      const tracking = await Tracking.findOne({ ticketId });

      if (!tracking) {
        return {
          success: false,
          error: "Tracking record not found",
          ticketId,
        };
      }

      if (tracking.callFinished) {
        return {
          success: false,
          error: "Ticket processing already completed",
          ticketId,
          completedAt: tracking.callFinished,
        };
      }

      const result = await this.processTicketBatch(tracking);

      return {
        success: true,
        ticketId,
        result,
      };
    } catch (error) {
      console.error(`❌ Error processing specific ticket ${ticketId}:`, error);
      return {
        success: false,
        error: error.message,
        ticketId,
      };
    }
  }
}

module.exports = new CronJobService();
