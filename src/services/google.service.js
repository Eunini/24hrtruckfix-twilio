// services/google.service.js
const {
  bookOrRescheduleEvent,
  checkCalendarAvailability,
  fetchCalendarEvent,
} = require("../utils/meetings");
const Meeting = require("../models/meeting"); // Import the Meeting model
const mongoose = require("mongoose");

const googleMeetingService = async (request) => {
  const {
    action,
    calendarInput,
    organizationId,
    mechanicId,
    attendeeIds = [],
  } = request;
  let result;
  console.log("Google Meeting Service Request:", request);
  switch (action) {
    case "CHECK_AVAILABILITY":
      try {
        const { startTime, timeZoneId, refresh_token, calendarId } =
          calendarInput;
        const availabilityResult = await checkCalendarAvailability({
          startTime: startTime,
          timeZoneId,
          refresh_token,
          calendarId,
        });
        return availabilityResult;
      } catch (error) {
        return {
          status: 400,
          error: `Error checking availability: ${error.message}`,
        };
      }

    case "BOOK_MEETING":
      try {
        const availabilityParams = {
          startTime: calendarInput.startTime,
          timeZoneId: calendarInput.timeZoneId,
          refresh_token: calendarInput.refresh_token,
        };

        const { status, message, availableSlots } =
          await checkCalendarAvailability(availabilityParams);

        console.log("Availability status:", status);

        if (status === 200 && calendarInput.startTime) {
          // Book the meeting in Google Calendar
          result = await bookOrRescheduleEvent({
            ...calendarInput,
            startTime: calendarInput.startTime,
            callId: request.callId,
          });

          if (result.status === 200) {
            try {
              // Calculate end time (1 hour after start time as per your original code)
              const utcTimestamp = `${calendarInput.startTime.slice(
                0,
                19
              )}+00:00`;
              const startDate = new Date(utcTimestamp);
              const endDate = new Date(startDate.getTime() + 3600000); // Add 1 hour in milliseconds

              // Create a new meeting in the database
              const newMeeting = new Meeting({
                title: calendarInput.summary || "Untitled Meeting",
                startTime: startDate,
                endTime: endDate,
                organizationId: organizationId || undefined,
                mechanicId: mechanicId || undefined,
                attendees: attendeeIds.map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
                description: calendarInput.description || undefined,
                eventId: result.eventId || undefined, // Store the Google Calendar event ID if available
                timeZoneId: calendarInput.timeZoneId,
                callId: request.callId,
              });

              await newMeeting.save();
              console.log("Meeting saved to database with ID:", newMeeting._id);
            } catch (dbError) {
              console.error("Error saving meeting to database:", dbError);
              // We continue even if database save fails, since Google Calendar event is created
              // But we add a note to the response
              result.message = `${result.message} (Note: There was an issue saving to the database: ${dbError.message})`;
            }
          }
        } else {
          result = { status, message, availableSlots };
        }
        return result;
      } catch (error) {
        return {
          status: 400,
          error: `Error booking meeting: ${error.message}`,
        };
      }

    case "RESCHEDULE_MEETING":
      try {
        if (!calendarInput.eventId) {
          return {
            status: 400,
            error: "Event ID is required for rescheduling",
          };
        }

        // First check if the meeting exists in our database
        const existingMeeting = await Meeting.findOne({
          eventId: calendarInput.eventId,
        });

        if (!calendarInput.startTime) {
          return {
            status: 400,
            error: "start time is needed",
          };
        }

        // Reschedule the meeting in Google Calendar
        result = await bookOrRescheduleEvent({
          ...calendarInput,
          startTime: calendarInput.startTime,
          callId: request.callId,
        });

        if (result.status === 200 && existingMeeting) {
          try {
            // Calculate new end time
            const utcTimestamp = `${calendarInput.startTime.slice(
              0,
              19
            )}+00:00`;
            const startDate = new Date(utcTimestamp);
            const endDate = new Date(startDate.getTime() + 3600000); // Add 1 hour

            // Update the existing meeting
            existingMeeting.title =
              calendarInput.summary || existingMeeting.title;
            existingMeeting.startTime = startDate;
            existingMeeting.endTime = endDate;
            existingMeeting.description =
              calendarInput.description !== null
                ? calendarInput.description
                : existingMeeting.description;
            existingMeeting.timeZoneId = calendarInput.timeZoneId;

            await existingMeeting.save();
            console.log(
              "Meeting updated in database with ID:",
              existingMeeting._id
            );
          } catch (dbError) {
            console.error("Error updating meeting in database:", dbError);
            // We continue even if database update fails
            result.message = `${result.message} (Note: There was an issue updating the database: ${dbError.message})`;
          }
        } else if (result.status === 200 && !existingMeeting) {
          // Meeting exists in Google Calendar but not in our database
          // Create a new record instead
          try {
            const utcTimestamp = `${calendarInput.startTime.slice(
              0,
              19
            )}+00:00`;
            const startDate = new Date(utcTimestamp);
            const endDate = new Date(startDate.getTime() + 3600000);

            const newMeeting = new Meeting({
              title: calendarInput.summary || "Untitled Meeting",
              startTime: startDate,
              endTime: endDate,
              organizationId: organizationId || undefined,
              mechanicId: mechanicId || undefined,
              attendees: attendeeIds.map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
              description: calendarInput.description || undefined,
              eventId: calendarInput.eventId,
              timeZoneId: calendarInput.timeZoneId,
            });

            await newMeeting.save();
            console.log(
              "Meeting record created in database for existing Google Calendar event:",
              newMeeting._id
            );
          } catch (dbError) {
            console.error(
              "Error creating meeting record in database:",
              dbError
            );
            result.message = `${result.message} (Note: There was an issue creating a database record: ${dbError.message})`;
          }
        }

        return result;
      } catch (error) {
        return {
          status: 400,
          error: `Error rescheduling meeting: ${error.message}`,
        };
      }

    case "FETCH_EVENT":
      try {
        if (!calendarInput.eventId) {
          return {
            status: 400,
            error: "Event ID is required to fetch event details",
          };
        }

        // Fetch the event from Google Calendar
        const googleEventResult = await fetchCalendarEvent({
          eventId: calendarInput.eventId,
          refresh_token: calendarInput.refresh_token,
        });

        if (googleEventResult.status !== 200) {
          return googleEventResult;
        }

        // Check if the event exists in our database
        let localMeeting = null;
        try {
          // Build query based on what's provided
          const query = { eventId: calendarInput.eventId };
          if (organizationId) {
            query.organizationId = organizationId;
          }
          if (mechanicId) {
            query.mechanicId = mechanicId;
          }

          localMeeting = await Meeting.findOne(query)
            .populate("attendees", "firstName lastName email")
            .lean();
        } catch (dbError) {
          console.error("Error fetching meeting from database:", dbError);
          // Continue even if database fetch fails
        }

        // Return both Google Calendar event and local meeting data
        return {
          status: 200,
          event: googleEventResult.event,
          localMeeting: localMeeting,
        };
      } catch (error) {
        return {
          status: 400,
          error: `Error fetching event: ${error.message}`,
        };
      }

    default:
      return {
        status: 400,
        message: "Invalid action",
      };
  }
};

module.exports = {
  googleMeetingService,
};
