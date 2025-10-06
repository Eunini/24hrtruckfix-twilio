const { google } = require("googleapis");
const moment = require("moment-timezone");
const { oauth2Client } = require("../config/google");

// Helper function to check if a date is a weekend
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function checkCalendarAvailability({
  startTime,
  timeZoneId,
  refresh_token,
  calendarId = "primary", // ✅ NEW: Allow dynamic calendar selection
}) {
  const utcTimestamp = `${startTime.slice(0, 19)}+00:00`;

  if (new Date(utcTimestamp).getTime() < new Date().getTime()) {
    return {
      status: 400,
      error: `Please provide a future date, The date provided is in the past, current date is ${new Date().toISOString()}`,
    };
  }

  const newTime = new Date(utcTimestamp).getTime() + 3600000;
  const beginTime = moment
    .utc(new Date(utcTimestamp))
    .tz(timeZoneId, true)
    .format();
  const endTime = moment.utc(new Date(newTime)).tz(timeZoneId, true).format();

  // Create OAuth2 client
  const auth = oauth2Client;
  auth.setCredentials({ refresh_token });
  google.options({ auth: auth });

  const calendar = google.calendar({ version: "v3" });

  try {
    console.log(beginTime);
    console.log(endTime);
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: beginTime,
        timeMax: endTime,
        timeZone: timeZoneId,
        items: [{ id: calendarId }], // ✅ CHANGED
      },
    });

    const eventArr = freeBusyResponse.data.calendars?.[calendarId]?.busy;

    if (eventArr?.length === 0) {
      return { status: 200, message: "Time slot is available" };
    }

    // Find alternative time slots
    let avaTimeSlot = endTime;
    let availableSlots = [];

    for (let i = 0; i <= 120; i++) {
      if (
        (availableSlots.length <= 2 && i <= 10) ||
        availableSlots.length === 0
      ) {
        const createNewEndTime = moment
          .utc(
            new Date(
              new Date(`${avaTimeSlot.slice(0, 19)}+00:00`).getTime() + 3600000
            )
          )
          .tz(timeZoneId, true)
          .format();

        if (isWeekend(new Date(avaTimeSlot))) {
          avaTimeSlot = moment
            .utc(
              new Date(
                new Date(`${avaTimeSlot.slice(0, 19)}+00:00`).getTime() +
                  86400000
              )
            )
            .tz(timeZoneId, true)
            .format();
          continue;
        }

        const freeTime = await calendar.freebusy.query({
          requestBody: {
            timeMin: avaTimeSlot,
            timeMax: createNewEndTime,
            timeZone: timeZoneId,
            items: [{ id: calendarId }], // ✅ CHANGED
          },
        });

        const busyTimes = freeTime.data.calendars?.[calendarId]?.busy;

        if (busyTimes?.length === 0) {
          availableSlots.push(avaTimeSlot);
        }
        avaTimeSlot = createNewEndTime;
      }
    }

    return {
      status: 400,
      message: "Time slot is busy",
      availableSlots: availableSlots,
    };
  } catch (error) {
    console.log("Availability check error:", error);
    return {
      status: 400,
      error:
        "Unable to check availability. Please check your credentials and permissions.",
    };
  }
}

async function bookOrRescheduleEvent({
  email,
  summary = null,
  startTime,
  timeZoneId,
  refresh_token,
  description = null,
  eventId = null,
  callId,
  calendarId = "primary", // ✅ NEW: Allow dynamic calendar selection
}) {
  const utcTimestamp = `${startTime.slice(0, 19)}+00:00`;

  if (new Date(utcTimestamp).getTime() < new Date().getTime()) {
    return { status: 400, error: "Please provide a future date" };
  }

  const newTime = new Date(utcTimestamp).getTime() + 3600000;
  const beginTime = moment
    .utc(new Date(utcTimestamp))
    .tz(timeZoneId, true)
    .format();
  const endTime = moment.utc(new Date(newTime)).tz(timeZoneId, true).format();

  // Create OAuth2 client
  const auth = oauth2Client;
  auth.setCredentials({ refresh_token });
  google.options({ auth: auth });

  const calendar = google.calendar({ version: "v3" });
  const event = {
    summary: summary ?? undefined,
    description: description ?? undefined,
    start: {
      dateTime: beginTime,
      timeZone: timeZoneId,
    },
    end: {
      dateTime: endTime,
      timeZone: timeZoneId,
    },
    attendees: [{ email }],
  };

  try {
    // Check if existing event exists when rescheduling
    if (eventId) {
      try {
        await calendar.events.get({
          calendarId, // ✅ CHANGED
          eventId: eventId,
        });
      } catch (retrieveError) {
        return {
          status: 400,
          error: "The event to reschedule does not exist or is inaccessible.",
          availableSlots: null,
        };
      }
    }

    // Perform booking/rescheduling
    let response;
    if (eventId) {
      response = await calendar.events.update({
        calendarId, // ✅ CHANGED
        eventId: eventId,
        requestBody: event,
      });
      console.log("Event updated:", response.data);
      return {
        status: 200,
        message: "Meeting rescheduled successfully",
        availableSlots: null,
        eventId: response.data.id,
      };
    } else {
      response = await calendar.events.insert({
        calendarId, // ✅ CHANGED
        requestBody: {
          ...event,
          reminders: { useDefault: true },
          conferenceData: {
            createRequest: {
              conferenceSolutionKey: {
                type: "hangoutsMeet",
              },
              requestId: callId,
              status: { statusCode: "success" },
            },
          },
        },
        conferenceDataVersion: 1,
        sendNotifications: true,
      });

      console.log("Event created:", response.data);
      return {
        status: 200,
        message: "Meeting booked successfully",
        availableSlots: null,
        eventId: response.data.id,
      };
    }
  } catch (error) {
    console.log("Booking/Rescheduling error:", error);
    return {
      status: 400,
      error:
        error.message ??
        "Unable to book/reschedule meeting. Check permissions and details.",
      availableSlots: null,
    };
  }
}

const fetchCalendarEvent = async ({
  eventId,
  refresh_token,
  calendarId = "primary", // ✅ NEW: Allow dynamic calendar selection
}) => {
  try {
    // Create OAuth2 client
    const auth = oauth2Client;
    auth.setCredentials({ refresh_token });
    google.options({ auth: auth });

    const calendar = google.calendar({ version: "v3" });

    try {
      // Fetch event from Google Calendar
      const response = await calendar.events.get({
        calendarId, // ✅ CHANGED
        eventId: eventId,
      });

      const eventData = {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees || [],
        organizer: response.data.organizer,
        hangoutLink: response.data.hangoutLink,
        conferenceData: response.data.conferenceData,
        status: response.data.status,
        recurrence: response.data.recurrence,
        location: response.data.location,
      };

      return {
        status: 200,
        event: eventData,
      };
    } catch (error) {
      if (
        error.code === 404 ||
        (error.response && error.response.status === 404)
      ) {
        return {
          status: 404,
          message: "Event not found in Google Calendar",
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error fetching Google Calendar event:", error);
    return {
      status: 400,
      error: `Unable to fetch event. ${error.message}`,
    };
  }
};

const testGoogleCalendarConnection = async (refresh_token) => {
  try {
    const auth = oauth2Client;
    auth.setCredentials({ refresh_token });
    google.options({ auth: auth });

    const calendar = google.calendar({ version: "v3" });
    const response = await calendar.calendarList.list();

    if (!response.data || !response.data.items) {
      return {
        status: 200,
        connected: true,
        message: "Connected to Google Calendar API, but no calendars found",
        calendarDetails: {
          calendars: [],
        },
      };
    }

    const calendars = response.data.items || [];
    const primaryCalendar = calendars.find((cal) => cal.primary === true);

    return {
      status: 200,
      connected: true,
      message: "Successfully connected to Google Calendar",
      calendarDetails: {
        primaryCalendarId: primaryCalendar?.id,
        email: primaryCalendar?.id || "",
        name: primaryCalendar?.summary || "Primary Calendar",
        calendars:
          calendars
            ?.filter(
              (cal) =>
                typeof cal.id === "string" && typeof cal.summary === "string"
            )
            .map((cal) => ({
              id: cal.id,
              summary: cal.summary,
              primary: cal.primary || false,
            })) || null,
      },
    };
  } catch (error) {
    console.error("Error testing Google Calendar connection:", error);

    if (error.response) {
      const statusCode = error.response.status;
      let errorMessage = "Unknown error occurred";
      let connectionStatus = false;

      switch (statusCode) {
        case 400:
          errorMessage = "Invalid request. The refresh token may be malformed.";
          break;
        case 401:
          errorMessage =
            "Authentication failed. Token may be expired or invalid.";
          break;
        case 403:
          errorMessage =
            "Authorization failed. Account lacks permission to access calendar.";
          break;
        case 404:
          errorMessage =
            "Calendar API endpoint not found. API may have changed.";
          break;
        case 429:
          errorMessage =
            "Rate limit exceeded. Too many requests to Google Calendar API.";
          break;
        default:
          errorMessage =
            error.response.data?.error?.message ||
            "Unknown Google Calendar API error";
      }

      return {
        status: statusCode,
        connected: connectionStatus,
        message: "Failed to connect to Google Calendar",
        error: errorMessage,
      };
    }

    return {
      status: 500,
      connected: false,
      message: "Failed to connect to Google Calendar",
      error: `Connection error: ${error.message}`,
    };
  }
};

module.exports = {
  checkCalendarAvailability,
  bookOrRescheduleEvent,
  fetchCalendarEvent,
  testGoogleCalendarConnection,
};
