#!/usr/bin/env node

/**
 * Startup script for the Cron Worker
 * This script sets up the environment and starts the background worker
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("🚀 Starting 24hr Service Cron Worker...");
console.log("📅 Environment:", process.env.NODE_ENV || "development");
console.log(
  "🌐 Target URL:",
  process.env.CRON_ENDPOINT_URL ||
    "https://two4hourservice-backend.onrender.com/api/v1/cron/process-batches"
);
console.log("");

// Start the worker
require("./src/workers/cronWorker");
