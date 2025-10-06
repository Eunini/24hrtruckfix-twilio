const { Organization } = require("../models/index");
const mongoose = require("mongoose");
const axios = require("axios");
const { testGoogleCalendarConnection } = require("../utils/meetings");

/**
 * Get calendar connection for an organization
 * @param req Request with organizationId
 * @param res Response with calendar connection data
 */
const getCalendarConnection = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    // Find the mechanic
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if calendar connection exists
    if (
      !organization.calendar_connection ||
      (!organization.calendar_connection.id_token &&
        !organization.calendar_connection.connectionRefreshToken)
    ) {
      return res.status(200).json({
        success: true,
        data: {
          hasConnection: false,
          message: "No calendar connection found",
        },
      });
    }

    // Return calendar connection info without sensitive data
    return res.status(200).json({
      success: true,
      data: {
        hasConnection: true,
        provider: organization.calendar_connection.provider,
        lastSync: organization.calendar_connection.lastSync,
        connected: true,
      },
    });
  } catch (error) {
    console.error("Error retrieving calendar connection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve calendar connection",
      error: error.message,
    });
  }
};

/**
 * Delete calendar connection for an organization
 * @param req Request with organizationId
 * @param res Response with deletion status
 */
const deleteCalendarConnection = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    // Find the mechanic
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if calendar connection exists
    if (
      !organization.calendar_connection ||
      (!organization.calendar_connection.id_token &&
        !organization.calendar_connection.connectionRefreshToken)
    ) {
      return res.status(200).json({
        success: true,
        message: "No calendar connection to delete",
      });
    }

    try {
      // Attempt to revoke access with the provider
      if (organization.calendar_connection.provider === "google") {
        await revokeGoogleAccess(organization.calendar_connection.id_token);
      } else if (organization.calendar_connection.provider === "outlook") {
        await revokeMicrosoftAccess(
          organization.calendar_connection.connectionRefreshToken
        );
      }
    } catch (revokeError) {
      console.error(
        `Error revoking ${organization.calendar_connection.provider} access:`,
        revokeError
      );
    }

    // Remove calendar connection from mechanic
    await Organization.findByIdAndUpdate(organizationId, {
      $unset: { calendar_connection: "" },
    });

    return res.status(200).json({
      success: true,
      message: "Calendar connection deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting calendar connection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete calendar connection",
      error: error.message,
    });
  }
};

/**
 * Revoke Google Calendar access
 * @param token The access token to revoke
 */
async function revokeGoogleAccess(token) {
  try {
    await axios.post("https://oauth2.googleapis.com/revoke", null, {
      params: { token },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.info("Google Calendar access successfully revoked");
  } catch (error) {
    console.error("Error revoking Google Calendar access:", error);
    throw error;
  }
}

/**
 * Revoke Microsoft Outlook Calendar access
 * @param refreshToken The refresh token to revoke
 */
async function revokeMicrosoftAccess(refreshToken) {
  try {
    // Microsoft doesn't have a simple revoke endpoint like Google
    // Typically, you would use the Microsoft Graph API to delete the permission
    // Here's a simplified example (you'll need to adjust this to your actual implementation)
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    // Microsoft's OAuth endpoint for token revocation
    // (This is a simplified approach - in production, you might need a more robust implementation)
    await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/logout",
      {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }
    );

    console.info("Microsoft Outlook Calendar access successfully revoked");
  } catch (error) {
    console.error("Error revoking Microsoft Outlook Calendar access:", error);
    throw error;
  }
}

const testConnection = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    let organization;
    if (organizationId) {
      // Test specific organization's connection (if provided)
      if (!mongoose.isValidObjectId(organizationId)) {
        return res.status(400).json({
          error: "Invalid organization ID format",
        });
      }

      organization = await Organization.findById(organizationId);

      if (!organization) {
        return res.status(400).json({
          error: "Organization not found",
        });
      }
    } else {
      // Test authenticated organization's connection
      organization = await Organization.findById(req.user?.id);

      if (!organization) {
        return res.status(400).json({
          error: "Organization not found",
        });
      }
    }

    if (!organization.calendar_connection) {
      return res.status(400).json({
        error: "Calendar connection not found",
      });
    }

    if (
      !["google", "outlook"].includes(organization.calendar_connection.provider)
    ) {
      return res.status(400).json({
        error: "Unsupported calendar provider",
      });
    }

    if (!organization.calendar_connection.connectionRefreshToken) {
      return res.status(400).json({
        error: "No refresh token found for calendar connection",
      });
    }

    let result = null;

    if (organization.calendar_connection.provider === "google") {
      result = await testGoogleCalendarConnection(
        organization.calendar_connection.connectionRefreshToken
      );
    } else {
      result = await testOutlookCalendarConnection(
        organization.calendar_connection.connectionRefreshToken
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error testing calendar connection:", error);
    return res.status(500).json({
      error: "Failed to test connection",
    });
  }
};

const saveCalendarOfChoice = async (req, res) => {
  const organization_id = req.user.organizationId;
  const { calenderId } = req.body;

  if (!calenderId) {
    return res.status(400).json({ error: "Calendar ID is required" });
  }

  try {
    const organization = await Organization.findById(organization_id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if organization has a calendar connection
    if (!organization.calendar_connection) {
      return res.status(400).json({
        error:
          "No calendar connection found. Please connect your calendar first.",
      });
    }

    // Update the calendar ID
    const updateResult = await Organization.findByIdAndUpdate(
      organization_id,
      { $set: { "calendar_connection.calendarId": calenderId } },
      { new: true }
    );

    if (!updateResult) {
      return res.status(500).json({
        error: "Failed to update calendar ID",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Calendar ID updated successfully",
      calendarId: calenderId,
    });
  } catch (error) {
    console.error("Error updating calendar ID:", error);
    return res.status(500).json({ error: "Failed to update calendar ID" });
  }
};

// /**
//  * Handle calendar actions (open endpoint - no authentication required)
//  * @param req Request with mechanic_id and action details
//  * @param res Response with action result
//  */
// export async function handleCalendarAction(
//   req: Request,
//   res: Response
// ): Promise<any> {
//   try {
//     const { mechanic_id } = req.params;

//     console.log(req.body);

//     const {
//       action = "BOOK_MEETING",
//       args,
//       call: { call_id },
//     } = req.body;

//     if (!action || !args || !mechanic_id || !call_id) {
//       return res.status(400).json({
//         error: "Missing required parameters",
//       });
//     }

//     if (!mongoose.isValidObjectId(mechanic_id)) {
//       return res.status(400).json({
//         error: "Invalid mechanic ID format",
//       });
//     }

//     const mechanic = await Mechanic.findById(mechanic_id);

//     if (!mechanic) {
//       return res.status(404).json({
//         error: "Mechanic not found",
//       });
//     }

//     if (!mechanic.calendar_connection) {
//       return res.status(400).json({
//         error: "This mechanic can't book a meeting. Please contact support.",
//       });
//     }

//     const provider = mechanic.calendar_connection.provider;

//     // Validate supported calendar providers
//     if (!["google", "outlook"].includes(provider)) {
//       return res.status(400).json({
//         error: `Unsupported calendar provider: ${provider}`,
//       });
//     }

//     if (!mechanic.calendar_connection.connectionRefreshToken) {
//       return res.status(400).json({
//         error:
//           "Calendar connection is not properly configured. Please contact support.",
//       });
//     }

//     console.log({
//       action,
//       calendarInput: {
//         ...args,
//         refresh_token: mechanic.calendar_connection.connectionRefreshToken,
//       },
//     });

//     // Call the appropriate calendar service based on provider
//     let result;
//     if (provider === "outlook") {
//       // Outlook service - to be implemented
//       return res.status(500).json({
//         error: "Outlook calendar service is not yet implemented",
//       });
//     } else {
//       // provider === 'google'
//       try {
//         const { googleMeetingService } = await import(
//           "../services/google.servcie"
//         );
//         result = await googleMeetingService({
//           action,
//           calendarInput: {
//             ...args,
//             refresh_token: mechanic.calendar_connection.connectionRefreshToken,
//           },
//           mechanicId: mechanic_id,
//           callId: call_id,
//         });
//       } catch (importError) {
//         console.error("Google service import error:", importError);
//         return res.status(500).json({
//           error: "Google calendar service is not available",
//         });
//       }
//     }

//     return res.status(result.status === 200 ? 200 : 400).json(result);
//   } catch (error: any) {
//     console.error(`Calendar action error (${error.message}):`, error);
//     return res.status(500).json({
//       error: `Failed to process calendar action: ${error.message}`,
//     });
//   }
// }

module.exports = {
  getCalendarConnection,
  deleteCalendarConnection,
  testConnection,
  saveCalendarOfChoice,
};
