const { oauth2Client } = require("../config/google");
const { Organization } = require("../models/index");
const mongoose = require("mongoose");

// Define the scopes you need
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

class GoogleController {
  static async initiateAuth(req, res) {
    try {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline", // Gets refresh token
        scope: SCOPES,
        prompt: "consent", // Forces consent screen to always appear
      });

      return res.status(200).json({ authUrl });
    } catch (error) {
      console.error("Error initiating Google auth:", error);
      return res
        .status(500)
        .json({ error: "Failed to initiate Google authentication" });
    }
  }

  static async callBackAuth(req, res) {
    const { code } = req.query;
    console.log(req.user);
    const organization_id = req.user.organizationId;

    if (!code) {
      return res.status(400).json({ error: "Authorization code not found" });
    }

    if (!organization_id) {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    if (!mongoose.isValidObjectId(organization_id)) {
      return res.status(400).json({ error: "Invalid organization ID format" });
    }

    try {
      // Find the mechanic
      const organization = await Organization.findById(organization_id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      const connection_data = {
        provider: "google",
        connectionRefreshToken: tokens.refresh_token,
        lastSync: new Date(),
        id_token: tokens.id_token,
      };

      // Update the Mechanic's calendar_connection
      const updateResult = await Organization.findByIdAndUpdate(
        organization_id,
        { $set: { calendar_connection: connection_data } },
        { new: true }
      );

      if (!updateResult) {
        return res.status(500).json({
          error: "Failed to update mechanic calendar connection",
        });
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: "Calendar connection established successfully",
        provider: "google",
        lastSync: connection_data.lastSync,
      });
    } catch (error) {
      console.error("Error getting tokens:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  }
}

module.exports = { GoogleController };
