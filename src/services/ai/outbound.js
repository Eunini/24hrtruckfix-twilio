const { nanoid } = require("nanoid");
const fetch = require("node-fetch");
const {
  notifyService,
  sendDriverSmsService,
  emitProgressService,
} = require("./notification");
const SystemStatus = require("../../models/systemStatus.model");
const Organization = require("../../models/organization.model");
const Ticket = require("../../models/ticket.model");
const AiConfig = require("../../models/ai-config.model");
const UrlForDriver = require("../../models/urlForDriver.model");
const Onboarding = require("../../models/onboarding.model");

const STATUS_ID = process.env.MONGODB_STATUS_ID;
const clientPhone = process.env.PHONE;
const clientEmail = process.env.TO_EMAIL;

/**
 * Service function to handle outbound processing of tickets
 * @param {string} ticketId - The ID of the ticket to process
 * @param {boolean} [shouldThrowError=true] - Whether to throw errors or return error status
 * @returns {Promise<Object>} The processing result
 */
async function outboundService(ticketId, shouldThrowError = true) {
  let clientId, insuredName, clientName;

  try {
    // STEP 1: System status check
    const sys = await SystemStatus.findById(STATUS_ID);
    if (!sys?.active) {
      console.log("ℹ️ System is currently inactive");
      return {
        success: false,
        message: "System is currently inactive",
        code: "SYS_INACTIVE",
        data: { ticketId },
      };
    }

    // STEP 2: Validate ticket ID
    if (!ticketId) {
      const error = new Error("Missing ticket ID");
      if (shouldThrowError) {
        throw Object.assign(error, {
          statusCode: 400,
          code: "NO_TICKET",
        });
      }
      return {
        success: false,
        message: error.message,
        code: "NO_TICKET",
        data: { ticketId },
      };
    }

    // STEP 3: Fetch ticket
    const ticketResp = await Ticket.findById(ticketId);
    if (!ticketResp) {
      const error = new Error("Ticket not found");
      if (shouldThrowError) {
        throw Object.assign(error, {
          statusCode: 404,
          code: "TICKET_NOT_FOUND",
        });
      }
      return {
        success: false,
        message: error.message,
        code: "TICKET_NOT_FOUND",
        data: { ticketId },
      };
    }
    clientId = ticketResp.organization_id.toString();
    insuredName = ticketResp.insured_name;

    // STEP 4: Fetch client organization
    const clientDoc = await Organization.findById(clientId);
    if (!clientDoc) {
      const error = new Error("Organization not found");
      if (shouldThrowError) {
        throw Object.assign(error, {
          statusCode: 404,
          code: "ORGANIZATION_NOT_FOUND",
        });
      }
      return {
        success: false,
        message: error.message,
        code: "ORGANIZATION_NOT_FOUND",
        data: { ticketId, clientId },
      };
    }

    // STEP 5: Check AI switch and config
    if (clientDoc.outboundAi === false) {
      console.log("ℹ️ AI switch is off for organization:", clientId);
      return {
        success: false,
        message: "AI switch is off",
        code: "AI_SWITCH_OFF",
        data: { clientId, ticketId },
      };
    }
    clientName = clientDoc.firstname;

    const configDoc = await AiConfig.findOne({ organization_id: clientId });
    if (!configDoc?.number) {
      const msg = !configDoc ? "No AI config" : "AI phone missing";
      const code = !configDoc ? "NO_AI_CONFIG" : "NO_AI_PHONE";
      const error = new Error(msg);
      if (shouldThrowError) {
        throw Object.assign(error, {
          statusCode: 404,
          code,
        });
      }
      return {
        success: false,
        message: msg,
        code,
        data: { ticketId, clientId },
      };
    }

    // STEP 6: Create or retrieve short URL
    let urlDoc = await UrlForDriver.findOne({ ticket_id: ticketId });
    if (!urlDoc) {
      try {
        const code = nanoid(8);
        const link = `https://roadrescue24hr.fillout.com/driverloc?jobId=${ticketId}`;
        urlDoc = await UrlForDriver.create({
          ticket_id: ticketId,
          link_id: code,
          org_id: clientDoc._id,
          link,
        });
      } catch (urlError) {
        console.error("❌ Error creating URL:", urlError);
        if (shouldThrowError) {
          throw Object.assign(urlError, {
            statusCode: 500,
            code: "URL_CREATE_ERROR",
          });
        }
        return {
          success: false,
          message: "Failed to create driver URL",
          code: "URL_CREATE_ERROR",
          data: { ticketId, clientId },
        };
      }
    }

    // STEP 7: Send SMS via Twilio
    const onboardDoc = await Onboarding.findOne({ user_id: clientDoc.owner });
    const formattedAddress = formatAddress(ticketResp.breakdown_address);
    const companyDetails = onboardDoc?.companyDetails || {};
    const toNumber = `${ticketResp.cell_country_code.dialCode || ""}${
      ticketResp.current_cell_number
    }`;
    const shortUrl = `${process.env.SERVER_URL}/dev/urlShortner/${urlDoc.link_id}`;

    try {
      const smsResult = await sendDriverSmsService({
        companyName: companyDetails.companyName,
        aiNumber: configDoc.number,
        address: formattedAddress,
        insuredName,
        shortUrl,
        toNumber,
      });

      console.log("SMS sent, SID:", smsResult.sid);
      await emitProgressService({
        ticketId,
        step: "sendDriverSms",
        status: "success",
        metadata: {
          insuredName,
          smsTo: smsResult.to,
          messageBody: smsResult.body,
          date:
            smsResult.date_sent ||
            smsResult.date_updated ||
            smsResult.date_created,
          deliveryStatus: smsResult.status || "delivered",
          sid: smsResult.sid,
          url: shortUrl,
        },
      });
    } catch (smsErr) {
      await emitProgressService({
        ticketId,
        step: "sendDriverSms",
        status: "error",
        metadata: {
          smsTo: toNumber,
          error: smsErr.message,
        },
      });
      if (shouldThrowError) {
        throw Object.assign(new Error(smsErr.message), {
          statusCode: 500,
          code: "SMS_SEND_ERROR",
        });
      }
      return {
        success: false,
        message: "Failed to send SMS",
        code: "SMS_SEND_ERROR",
        data: { ticketId, clientId, error: smsErr.message },
      };
    }

    // STEP 8: Trigger location processing asynchronously
    try {
      const locationPayload = {
        id: ticketId,
        address: formattedAddress,
      };

      // Make async call to location endpoint (fire and forget)
      console.log(`🚀 Triggering location processing for ticket ${ticketId}`);

      // Using process.env.SERVER_URL or fallback to localhost if not set
      const serverUrl = process.env.SERVER_URL || "http://localhost:5000";
      const locationEndpoint = `${serverUrl}/api/v1/receive-location-data`;

      // Make the call asynchronously without blocking the main flow
      const locationCall = fetch(locationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add any auth headers if needed
        },
        body: JSON.stringify(locationPayload),
      })
        .then(async (response) => {
          if (response.ok) {
            const result = await response.json();
            console.log(
              `✅ Location processing initiated successfully for ticket ${ticketId}:`,
              result
            );

            // Update ticket status to initiated on success
            await Ticket.findByIdAndUpdate(ticketId, {
              auto_assignment_status: "initiated",
              auto_assigned_at: new Date(),
            });
            console.log(`✅ Ticket ${ticketId} status updated to 'initiated'`);
          } else {
            const errorText = await response.text();
            console.error(
              `❌ Location processing failed for ticket ${ticketId}:`,
              errorText
            );

            // Update ticket status to failed on location processing failure
            // await Ticket.findByIdAndUpdate(ticketId, {
            //   auto_assignment_status: "failed",
            //   auto_assigned_at: new Date(),
            // });
            console.log(
              `❌ Ticket ${ticketId} status updated to 'failed' due to location processing error`
            );
          }
        })
        .catch(async (error) => {
          console.error(
            `❌ Error calling location endpoint for ticket ${ticketId}:`,
            error.message
          );

          // Update ticket status to failed on network/other errors
          // await Ticket.findByIdAndUpdate(ticketId, {
          //   auto_assignment_status: "failed",
          //   auto_assigned_at: new Date(),
          // });
          console.log(
            `❌ Ticket ${ticketId} status updated to 'failed' due to location endpoint error`
          );
        });

      // Don't await the location call - let it run asynchronously
      console.log(
        `🔄 Location processing call dispatched for ticket ${ticketId}`
      );
    } catch (locationError) {
      console.error("❌ Error dispatching location processing:", locationError);

      // Update ticket status to failed if we can't even dispatch the location call
      await Ticket.findByIdAndUpdate(ticketId, {
        auto_assignment_status: "failed",
        auto_assigned_at: new Date(),
      });

      if (shouldThrowError) {
        throw Object.assign(locationError, {
          statusCode: 500,
          code: "LOCATION_DISPATCH_ERROR",
        });
      }
      return {
        success: false,
        message: "Failed to dispatch location processing",
        code: "LOCATION_DISPATCH_ERROR",
        data: { ticketId, clientId },
      };
    }

    return {
      success: true,
      message: "Outbound flow initiated",
      data: { clientId, ticketId },
    };
  } catch (error) {
    console.error("❌ Error in outboundService:", error);

    await notifyService({
      ticketId,
      clientId,
      functionKey: "sendDriverSms",
      status: "error",
      params: { error: error.message },
      shouldThrowError: false,
    });

    if (shouldThrowError) {
      throw Object.assign(new Error(error.message), {
        statusCode: error.statusCode || 500,
        code: error.code || "OUTBOUND_ERROR",
      });
    }
    return {
      success: false,
      message: error.message,
      code: error.code || "OUTBOUND_ERROR",
      data: { ticketId, clientId },
    };
  }
}

/**
 * Helper function to format address for SMS
 * @param {string|object} address - The address to format (string or breakdown_address object)
 * @returns {string} Formatted address
 */
function formatAddress(address) {
  if (!address) return "";

  // If it's a string, just clean up whitespace
  if (typeof address === "string") {
    return address.replace(/\s+/g, " ").trim();
  }

  // If it's an object with breakdown_address structure
  if (typeof address === "object") {
    const parts = [];

    // Add address line 1 if available
    if (address.address_line_1) {
      parts.push(address.address_line_1.replace(/\s+/g, " ").trim());
    }

    // Add street if different from address_line_1
    if (address.street && address.street !== address.address_line_1) {
      parts.push(address.street.replace(/\s+/g, " ").trim());
    }

    // Add city
    if (address.city) {
      parts.push(address.city.replace(/\s+/g, " ").trim());
    }

    // Add state
    if (address.state) {
      parts.push(address.state.replace(/\s+/g, " ").trim());
    }

    // Add zipcode
    if (address.zipcode) {
      parts.push(address.zipcode.toString().replace(/\s+/g, " ").trim());
    }

    // Join all parts with commas and return
    return parts.filter((part) => part.length > 0).join(", ");
  }

  return "";
}

module.exports = {
  outboundService,
};
