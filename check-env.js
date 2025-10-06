#!/usr/bin/env node

/**
 * Environment Variable Checker
 *
 * This script checks if all required environment variables are set correctly
 * for the chat session timeout worker.
 */

require("dotenv").config();

const env = require("./src/config");

console.log("🔍 Environment Variable Check");
console.log("============================");

// Check Google AI configuration
console.log("\n📊 Google AI Configuration:");
console.log(
  "  GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY ? "✅ Set" : "❌ Not set"
);
console.log(
  "  GOOGLE_API_KEY:",
  process.env.GOOGLE_API_KEY ? "✅ Set" : "❌ Not set"
);
console.log(
  "  env.google.gemini:",
  env.google?.gemini ? "✅ Available" : "❌ Not available"
);

// Check Redis configuration
console.log("\n🔴 Redis Configuration:");
console.log("  REDIS_HOST:", process.env.REDIS_HOST || "localhost (default)");
console.log("  REDIS_PORT:", process.env.REDIS_PORT || "6379 (default)");
console.log(
  "  REDIS_PASSWORD:",
  process.env.REDIS_PASSWORD ? "✅ Set" : "❌ Not set"
);
console.log("  REDIS_DB:", process.env.REDIS_DB || "0 (default)");

// Check MongoDB configuration
console.log("\n🍃 MongoDB Configuration:");
console.log(
  "  MONGODB_URI:",
  process.env.MONGODB_URI ? "✅ Set" : "❌ Not set"
);
console.log("  MONGO_URI:", process.env.MONGO_URI ? "✅ Set" : "❌ Not set");

// Check HubSpot configuration
console.log("\n🏢 HubSpot Configuration:");
console.log(
  "  HUBSPOT_API_KEY:",
  process.env.HUBSPOT_API_KEY ? "✅ Set" : "❌ Not set"
);

// Test Google AI package availability
console.log("\n📦 Package Availability:");
try {
  require("@google/genai");
  console.log("  @google/genai: ✅ Available");
} catch (error) {
  console.log("  @google/genai: ❌ Not available");
}

try {
  require("@google/generative-ai");
  console.log("  @google/generative-ai: ✅ Available");
} catch (error) {
  console.log("  @google/generative-ai: ❌ Not available");
}

// Test Google AI initialization
console.log("\n🤖 Google AI Initialization Test:");
try {
  if (env.google?.gemini) {
    try {
      const { GoogleGenAI } = require("@google/genai");
      const googleAI = new GoogleGenAI({ apiKey: env.google.gemini });
      const model = googleAI.models.get("gemini-2.0-flash");
      console.log("  @google/genai initialization: ✅ Success");
    } catch (genaiError) {
      console.log(
        "  @google/genai initialization: ❌ Failed -",
        genaiError.message
      );

      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(env.google.gemini);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("  @google/generative-ai initialization: ✅ Success");
      } catch (generativeError) {
        console.log(
          "  @google/generative-ai initialization: ❌ Failed -",
          generativeError.message
        );
      }
    }
  } else {
    console.log("  Google AI initialization: ❌ No API key available");
  }
} catch (error) {
  console.log("  Google AI initialization: ❌ Error -", error.message);
}

console.log("\n🎯 Recommendations:");
if (!env.google?.gemini) {
  console.log("  ⚠️  Set GEMINI_API_KEY environment variable");
}
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.log("  ⚠️  Set MONGODB_URI environment variable");
}
if (!process.env.HUBSPOT_API_KEY) {
  console.log(
    "  ⚠️  Set HUBSPOT_API_KEY environment variable (optional for transcript analysis)"
  );
}

console.log("\n✅ Environment check completed!");
