const cronJobService = require("../services/cronJob.service");
const { HTTP_STATUS_CODES } = require("../helper");
const fetch = require("node-fetch");
const MechanicsQueue = require("../models/mechanicsQueue.model");
const Tracking = require("../models/tracking.model");
const Ticket = require("../models/ticket.model");
const AiConfig = require("../models/ai-config.model");
const AICallActivity = require("../models/ai-call-activity.model");
const Organization = require("../models/organization.model");
const {
  dispatchCallSystemPrompt,
} = require("../utils/prompts/outbound_prompt");
const {
  clientCustomPromptService,
} = require("../services/clientCustomPrompt.service");

// Helper function to check if VAPI has ongoing calls
function checkCallStatus(data) {
  if (!data || !data.data || !Array.isArray(data.data)) {
    return false;
  }

  return data.data.some(
    (call) =>
      call.status === "queued" ||
      call.status === "in-progress" ||
      call.status === "ringing"
  );
}

// Helper function to check if 10 minutes has elapsed since interest was found
function hasInterestTimeElapsed(record) {
  if (!record || !record.foundInterestTime) {
    return false;
  }

  const foundInterestTimeUnix =
    new Date(record.foundInterestTime).getTime() / 1000;
  const currentTimeUnix = new Date().getTime() / 1000;
  const timeDifferenceUnix = currentTimeUnix - foundInterestTimeUnix;
  const tenMinutesInUnix = 10 * 60;
  const result = timeDifferenceUnix <= tenMinutesInUnix;

  console.log(
    `⏰ Interest check for ticket ${record.ticketId}: ${
      result ? "Within" : "Beyond"
    } 10 minutes`
  );
  return result;
}

// Helper function to format distance response
function formatDistance(distanceData) {
  try {
    let distance = distanceData.rows[0].elements[0].distance.text;

    if (distanceData.rows[0].elements[0].distance.text.split(" ")[1] === "km") {
      const distanceInMiles =
        Math.ceil(
          (distanceData.rows[0].elements[0].distance.value / 1.60934 / 1000) *
            10
        ) / 10;
      distance = distanceInMiles + " mi";
    }

    return distance;
  } catch (err) {
    console.error("❌ Error formatting distance:", err);
    return "";
  }
}

// Helper function to format address for API calls
function formatAddress(address) {
  if (!address) return "";

  if (typeof address === "string") {
    return address.replace(/\s+/g, " ").trim();
  }

  if (typeof address === "object") {
    const parts = [];

    if (address.address_line_1) {
      parts.push(address.address_line_1.replace(/\s+/g, " ").trim());
    }

    if (address.street && address.street !== address.address_line_1) {
      parts.push(address.street.replace(/\s+/g, " ").trim());
    }

    if (address.city) {
      parts.push(address.city.replace(/\s+/g, " ").trim());
    }

    if (address.state) {
      parts.push(address.state.replace(/\s+/g, " ").trim());
    }

    if (address.zipcode) {
      parts.push(address.zipcode.toString().replace(/\s+/g, " ").trim());
    }

    return parts.filter((part) => part.length > 0).join(", ");
  }

  return "";
}

/**
 * Cron Job Controllers for scheduled task management via API endpoints
 */
class CronJobController {
  /**
   * Process ticket batches - Main cron job functionality
   * @route POST /api/v1/cron/process-batches
   */
  async processBatches(req, res) {
    try {
      console.log("🔄 API triggered: Process ticket batches");

      // STEP 1: Check if system is active
      console.log("✅ System is active, proceeding with batch processing");

      // STEP 2: Check VAPI call status
      console.log("📞 Checking VAPI call status...");
      const vapiResponse = await fetch("https://api.vapi.ai/call?limit=20", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer 9a8d1c07-e26f-4106-8958-3b4c71b5c90f",
        },
      });

      const vapiData = await vapiResponse.json();
      const hasOngoingCalls = checkCallStatus(vapiData);

      if (hasOngoingCalls) {
        console.log("📞 VAPI has ongoing calls, stopping processing");
        return res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          message: "VAPI is busy with ongoing calls, processing paused",
          data: { status: "paused", reason: "vapi_busy" },
        });
      }

      console.log("📞 VAPI is free, proceeding with mechanic calls");

      // STEP 3: Retrieve 10 mechanics from MechanicsQueue
      const mechanics = await MechanicsQueue.find({}).limit(10);

      if (mechanics.length === 0) {
        console.log("👨‍🔧 No mechanics found in queue");
        return res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          message: "No mechanics in queue to process",
          data: { processed: 0, reason: "no_mechanics" },
        });
      }

      console.log(`👨‍🔧 Found ${mechanics.length} mechanics to process`);

      // STEP 4: Process each mechanic
      const processedTickets = new Map();
      const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        calls_made: 0,
      };

      for (const mechanic of mechanics) {
        try {
          const ticketId = mechanic.ticketId;

          // Skip if we've already processed this ticket in this batch
          if (processedTickets.has(ticketId)) {
            console.log(
              `⏭️ Skipping ticket ${ticketId} - already processed in this batch`
            );
            results.skipped++;
            continue;
          }

          // Get the ticket associated with the mechanic
          const ticket = await Ticket.findById(ticketId);
          if (!ticket) {
            console.log(`❌ Ticket ${ticketId} not found`);
            results.errors++;
            continue;
          }

          // Get tracking record for this ticket
          const tracking = await Tracking.findOne({ ticketId: ticketId });
          if (!tracking) {
            console.log(`❌ Tracking record for ticket ${ticketId} not found`);
            results.errors++;
            continue;
          }

          // Check if 10 minutes has elapsed since someone found interest
          if (tracking.foundInterest && hasInterestTimeElapsed(tracking)) {
            console.log(
              `⏰ Skipping ticket ${ticketId} - still within 10-minute interest window`
            );
            processedTickets.set(ticketId, true);
            results.skipped++;
            continue;
          }

          // Get breakdown address and format it
          const breakdownAddress = formatAddress(ticket.breakdown_address);
          if (!breakdownAddress) {
            console.log(`❌ No breakdown address for ticket ${ticketId}`);
            results.errors++;
            continue;
          }

          // Get distance using Google Distance Matrix API
          console.log(
            `📍 Calculating distance for mechanic: ${mechanic.displayName.text}`
          );
          const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
            breakdownAddress
          )}&destinations=${encodeURIComponent(
            mechanic.formattedAddress
          )}&key=${process.env.GOOGLE_MAPS_API_KEY}&units=imperial`;

          const distanceResponse = await fetch(distanceUrl);
          const distanceData = await distanceResponse.json();
          const formattedDistance = formatDistance(distanceData);

          // Get AI config for phone number
          const aiConfig = await AiConfig.findOne({
            organization_id: ticket.organization_id,
          });
          if (!aiConfig || !aiConfig.number) {
            console.log(
              `❌ No AI config or phone number for ticket ${ticketId}`
            );
            results.errors++;
            continue;
          }

          // Prepare breakdown reasons
          const primaryReason =
            ticket.breakdown_reason && ticket.breakdown_reason.length > 0
              ? ticket.breakdown_reason.map((r) => r.label || r.key).join(", ")
              : "mechanical breakdown";
          const secondaryReason = ticket.breakdown_reason_text || "";

          // Format tow destination if exists
          const towDestination = ticket.tow_destination
            ? formatAddress(ticket.tow_destination)
            : null;

          // Get organization data
          const organization = await Organization.findById(
            ticket.organization_id
          );
          if (!organization) {
            console.log(`❌ No organization found for ticket ${ticketId}`);
            results.errors++;
            continue;
          }

          // Get custom prompt for dispatch type
          let customPrompt;
          let firstMessage = `Hello am I unto ${mechanic.displayName.text}`;

          try {
            customPrompt =
              await clientCustomPromptService.findByOrganizationIdAndType(
                ticket.organization_id,
                "dispatch"
              );
          } catch (error) {
            console.log(
              `⚠️ Error fetching custom prompt for ticket ${ticketId}:`,
              error.message
            );
          }

          let systemPrompt;

          if (customPrompt && customPrompt.prompt) {
            // Use custom prompt
            console.log(
              `✅ Using custom dispatch prompt for ticket ${ticketId}`
            );

            // If custom prompt is a function (default prompt), call it with parameters
            if (typeof customPrompt.prompt === "function") {
              const companyName =
                organization.companyName || "24Hr Truck Services";
              const vehicleInfo = `${ticket.vehicle_color} ${ticket.vehicle_year} ${ticket.vehicle_make} ${ticket.vehicle_model}`;
              const ownerNumber = `${
                ticket.cell_country_code?.dialCode || "+1"
              }${ticket.current_cell_number}`;
              const distance = `${formattedDistance || "nearby"}`;
              const ticketType = towDestination ? "tow" : "repair";

              systemPrompt = customPrompt.prompt({
                companyName,
                vehicleInfo,
                ownerNumber,
                distance,
                ticketType,
                primaryReason,
                secondaryReason,
                breakdownAddress,
                towDestination,
                displayName: mechanic.displayName,
                ticket,
                ticketId,
                companyType: organization.organization_type || "fleet",
                miles: formattedDistance || "nearby",
                address: mechanic.formattedAddress,
              });
            } else {
              // Use custom prompt as-is (string or object)
              systemPrompt = customPrompt.prompt;
            }

            // Use custom first message if available
            if (customPrompt.staticMessage) {
              firstMessage = customPrompt.staticMessage;
            }
          } else {
            // Fallback to default prompt
            console.log(
              `📝 Using default dispatch prompt for ticket ${ticketId}`
            );
            const companyName =
              organization.companyName || "24Hr Truck Services";
            const vehicleInfo = `${ticket.vehicle_color} ${ticket.vehicle_year} ${ticket.vehicle_make} ${ticket.vehicle_model}`;
            const ownerNumber = `${ticket.cell_country_code?.dialCode || "+1"}${
              ticket.current_cell_number
            }`;
            const distance = `${formattedDistance || "nearby"}`;
            const ticketType = towDestination ? "tow" : "repair";

            systemPrompt = dispatchCallSystemPrompt({
              companyName,
              vehicleInfo,
              ownerNumber,
              distance,
              ticketType,
              primaryReason,
              secondaryReason,
              breakdownAddress,
              towDestination,
              displayName: mechanic.displayName,
              ticket,
              ticketId,
              companyType: organization.organization_type || "fleet",
              miles: formattedDistance || "nearby",
              address: mechanic.formattedAddress,
            });
          }

          // Create VAPI call payload
          const callPayload = {
            assistant: {
              model: {
                model: "gpt-4o",
                systemPrompt: systemPrompt,
                temperature: 0.7,
                provider: "openai",
                tools: [
                  {
                    type: "function",
                    async: false,
                    function: {
                      name: "createJobRequest",
                      description:
                        "This is used to create a job request after taking all the needed information from the user.",
                      parameters: {
                        type: "object",
                        properties: {
                          eta: {
                            type: "string",
                            description: "Estimated time of arrival",
                          },
                          services: {
                            type: "array",
                            description:
                              "An array of all the services to be provided by the service provider",
                            items: [
                              {
                                type: "string",
                                description: "The name of the service",
                              },
                            ],
                          },
                          total_cost: {
                            type: "string",
                            description:
                              "A median of the cost Total range that was given by the Service Provider during the call. Pass it as a number or float",
                          },
                        },
                        required: ["eta", "services", "total_cost"],
                      },
                    },
                    server: {
                      url:
                        `https://sp-24hr-server.onrender.com/api/v1/request/create/ai?` +
                        `apiKey=${encodeURIComponent(
                          process.env.SETUP_VAPI_API_KEY
                        )}` +
                        `&mechanic=${encodeURIComponent(
                          mechanic.internationalPhoneNumber
                        )}` +
                        `&name=${encodeURIComponent(
                          mechanic.displayName.text
                        )}` +
                        `&ticket_id=${encodeURIComponent(ticketId)}`,
                    },
                  },
                ],
              },
              endCallFunctionEnabled: true,
              firstMessage: firstMessage,
            },
            phoneNumber: {
              twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
              twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
              twilioPhoneNumber: aiConfig.number,
            },
            assistantId: aiConfig.assistant_id,
            customer: {
              name: mechanic.displayName.text,
              number: "+2348148672106", // mechanic.internationalPhoneNumber,
            },
          };

          // Make VAPI call
          console.log(
            `📞 Making VAPI call to ${mechanic.displayName.text} for ticket ${ticketId}`
          );
          const callResponse = await fetch("https://api.vapi.ai/call/phone", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer 9a8d1c07-e26f-4106-8958-3b4c71b5c90f",
            },
            body: JSON.stringify(callPayload),
          });

          if (callResponse.ok) {
            console.log(
              `✅ Call initiated successfully for ${mechanic.displayName.text}`
            );
            results.calls_made++;

            // Delete the mechanic from queue
            await MechanicsQueue.findByIdAndDelete(mechanic._id);

            // Update tracking record - increment called mechanics
            const currentCalledMechanics = tracking.calledMechanics + 1;
            const isLastMechanic =
              currentCalledMechanics >= tracking.totalMechanics;

            if (isLastMechanic) {
              // This is the last mechanic, mark as finished
              await Tracking.findOneAndUpdate(
                { ticketId: ticketId },
                {
                  $set: {
                    calledMechanics: currentCalledMechanics,
                    callFinished: new Date(),
                  },
                },
                { new: true }
              );
              console.log(
                `🏁 All mechanics called for ticket ${ticketId}, marking as finished`
              );
            } else {
              // Update called mechanics count
              await Tracking.findOneAndUpdate(
                { ticketId: ticketId },
                { $set: { calledMechanics: currentCalledMechanics } },
                { new: true }
              );
              console.log(
                `📊 Updated called mechanics count for ticket ${ticketId}: ${currentCalledMechanics}/${tracking.totalMechanics}`
              );
            }
            console.log(callResponse);
            await AICallActivity.create({
              call_id: callResponse.call_id,
              organization_id: ticket.organization_id,
              call_type: "outbound",
              number: mechanic.internationalPhoneNumber,
              recorded_time: new Date(),
            });

            processedTickets.set(ticketId, true);
            results.processed++;
          } else {
            const errorData = await callResponse.text();
            console.error(
              `❌ Failed to initiate call for ${mechanic.displayName.text}:`,
              errorData
            );
            results.errors++;
          }
        } catch (mechanicError) {
          console.error(
            `❌ Error processing mechanic ${mechanic.displayName?.text}:`,
            mechanicError
          );
          results.errors++;
        }
      }

      console.log(`✅ Batch processing completed: ${JSON.stringify(results)}`);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Ticket batch processing completed",
        data: results,
      });
    } catch (error) {
      console.error("❌ Process batches error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to process ticket batches",
        error: error.message,
      });
    }
  }

  /**
   * Get tracking statistics
   * @route GET /api/v1/cron/stats
   */
  async getStats(req, res) {
    try {
      const stats = await cronJobService.getTrackingStats();

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Tracking statistics retrieved",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Get stats error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get tracking statistics",
        error: error.message,
      });
    }
  }

  /**
   * Clean up expired tracking records
   * @route POST /api/v1/cron/cleanup
   */
  async cleanupExpired(req, res) {
    try {
      console.log("🧹 API triggered: Cleanup expired tracking");

      const result = await cronJobService.cleanupExpiredTracking();

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: result.message || "Cleanup completed",
        data: result,
      });
    } catch (error) {
      console.error("❌ Cleanup error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to cleanup expired tracking",
        error: error.message,
      });
    }
  }

  /**
   * Process specific ticket manually
   * @route POST /api/v1/cron/process-ticket/:ticketId
   */
  async processSpecificTicket(req, res) {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Ticket ID is required",
        });
      }

      console.log(`🎯 API triggered: Process specific ticket ${ticketId}`);

      const result = await cronJobService.processSpecificTicket(ticketId);

      if (result.success) {
        res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          message: `Ticket ${ticketId} processing completed`,
          data: result,
        });
      } else {
        res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: result.error || `Failed to process ticket ${ticketId}`,
          data: result,
        });
      }
    } catch (error) {
      console.error("❌ Process specific ticket error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to process specific ticket",
        error: error.message,
      });
    }
  }

  /**
   * Health check for cron job services
   * @route GET /api/v1/cron/health
   */
  async healthCheck(req, res) {
    try {
      const stats = await cronJobService.getTrackingStats();

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Cron job service is healthy",
        timestamp: new Date().toISOString(),
        stats,
        endpoints: {
          processBatches: "POST /api/v1/cron/process-batches",
          getStats: "GET /api/v1/cron/stats",
          cleanup: "POST /api/v1/cron/cleanup",
          processTicket: "POST /api/v1/cron/process-ticket/:ticketId",
        },
      });
    } catch (error) {
      console.error("❌ Cron health check error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Cron job service health check failed",
        error: error.message,
      });
    }
  }

  /**
   * Run a complete maintenance cycle
   * @route POST /api/v1/cron/maintenance
   */
  async runMaintenance(req, res) {
    try {
      console.log("🔧 API triggered: Complete maintenance cycle");

      const maintenanceStart = Date.now();
      const results = {
        cleanup: null,
        processing: null,
        finalStats: null,
      };

      // Step 1: Cleanup expired records
      console.log("🧹 Step 1: Cleaning up expired records...");
      results.cleanup = await cronJobService.cleanupExpiredTracking();

      // Step 2: Process active batches
      console.log("🔄 Step 2: Processing active batches...");
      results.processing = await cronJobService.processTicketBatches();

      // Step 3: Get final statistics
      console.log("📊 Step 3: Getting final statistics...");
      results.finalStats = await cronJobService.getTrackingStats();

      const maintenanceTime = Date.now() - maintenanceStart;

      console.log(`✅ Maintenance cycle completed in ${maintenanceTime}ms`);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Maintenance cycle completed successfully",
        maintenanceTime: `${maintenanceTime}ms`,
        data: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Maintenance cycle error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Maintenance cycle failed",
        error: error.message,
        maintenanceTime: `${
          Date.now() - (req.maintenanceStart || Date.now())
        }ms`,
      });
    }
  }

  /**
   * Schedule configuration endpoint - for external schedulers
   * @route GET /api/v1/cron/schedule-config
   */
  async getScheduleConfig(req, res) {
    try {
      const config = {
        mainProcessing: {
          endpoint: "/api/v1/cron/process-batches",
          method: "POST",
          schedule: "*/2 * * * *", // Every 2 minutes
          description: "Process ticket batches (main cron job)",
        },
        cleanup: {
          endpoint: "/api/v1/cron/cleanup",
          method: "POST",
          schedule: "*/10 * * * *", // Every 10 minutes
          description: "Cleanup expired tracking records",
        },
        maintenance: {
          endpoint: "/api/v1/cron/maintenance",
          method: "POST",
          schedule: "0 */6 * * *", // Every 6 hours
          description: "Complete maintenance cycle",
        },
        healthCheck: {
          endpoint: "/api/v1/cron/health",
          method: "GET",
          schedule: "*/5 * * * *", // Every 5 minutes
          description: "Health check and monitoring",
        },
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Schedule configuration retrieved",
        data: config,
        instructions: {
          note: "Use these endpoints with your preferred scheduler (cron, K8s CronJob, etc.)",
          authentication: "All endpoints require proper authentication",
          monitoring: "Monitor the health endpoint for service status",
        },
      });
    } catch (error) {
      console.error("❌ Get schedule config error:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get schedule configuration",
        error: error.message,
      });
    }
  }
}

module.exports = new CronJobController();
