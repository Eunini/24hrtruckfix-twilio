const { VapiClient } = require("@vapi-ai/server-sdk");

const vapiClient = new VapiClient({ token: process.env.VAPI_API_KEY });

module.exports = vapiClient;
