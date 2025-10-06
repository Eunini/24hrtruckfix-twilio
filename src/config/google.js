const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require(".");

const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

const genAI = new GoogleGenerativeAI(config.google.gemini);

module.exports = { oauth2Client, genAI };
