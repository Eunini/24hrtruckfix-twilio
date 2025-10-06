const mongoose = require("mongoose");
const axios = require("axios");
const { Type } = require("@google/genai");
const env = require("../config");
const { bookOrRescheduleEvent } = require("../utils/meetings");
const { Organization } = require("../models");

/**
 * Service to handle appointment booking functionality
 */
class AppointmentBookingTool {
  /**
   * Get the function declaration for the Appointment_BookingTool
   */
  static getFunctionDeclaration() {
    return {
      name: "Appointment_BookingTool",
      description: "Book an appointment with the mechanic",
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "Title or summary of the meeting or event",
          },
          description: {
            type: Type.STRING,
            description: "Detailed description of the meeting or event",
          },
          startTime: {
            type: Type.STRING,
            description: "ISO 8601 formatted start time of the appointment",
          },
          timeZoneId: {
            type: Type.STRING,
            description: "Time zone identifier (e.g., 'America/New_York')",
          },
          email: {
            type: Type.STRING,
            description: "Email address of the attendee",
          },
        },
        required: ["email", "summary", "startTime", "timeZoneId"],
      },
    };
  }

  /**
   * Book an appointment with the mechanic
   * @param mechanicId Mechanic ID where the appointment will take place
   * @param params Appointment parameters
   * @returns Booking confirmation
   */
  static async execute(params, mechanicId) {
    if (!mechanicId) {
      throw new Error("Mechanic ID is required for appointment booking");
    }

    if (params.isOrg) {
      try {
        const org = await Organization.findOne({
          _id: new mongoose.Types.ObjectId(mechanicId),
        }).select("calendar_connection");

        if (!org) {
          throw new Error("Organization not found");
        }

        const calendarConnection = org.calendar_connection;

        const result = await bookOrRescheduleEvent({
          ...params,
          refresh_token: calendarConnection.connectionRefreshToken,
          calendarId: calendarConnection.calendarId ?? "default",
        });

        return result;
      } catch (error) {
        console.error("Error booking appointment:", error.message);
        throw new Error(error.message);
      }
    } else {
      try {
        // Construct the base URL for the appointment booking API
        const baseUrl = env.tools.appointmentBooking.url;
        const url = `${baseUrl}/api/v1/calendar/action/${mechanicId}`;

        // Add default description if not provided
        const bookingParams = {
          args: {
            ...params,
            description: params.description || "Vehicle Service Appointment",
            mechanic_id: mechanicId.toString(),
          },
          call: {
            call_id: params.threadId,
          },
        };

        console.log(
          `Booking appointment for mechanic ${mechanicId}`,
          bookingParams
        );

        console.log(url);

        // Make the API call to the external booking service
        const response = await axios.post(url, bookingParams);

        // Return the booking confirmation
        return response.data;
      } catch (error) {
        console.error("Error booking appointment:", error.message);

        // Enhance error message based on common issues
        let errorMessage = "Failed to book appointment.";

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const statusCode = error.response.status;
          const errorData = error.response.data;

          return { statusCode, errorData };
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage =
            "Could not reach the booking service. Please try again later.";
        }

        throw new Error(errorMessage);
      }
    }
  }
}

module.exports = AppointmentBookingTool;
