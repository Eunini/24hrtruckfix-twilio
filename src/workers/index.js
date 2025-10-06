#!/usr/bin/env node

/**
 * Background Worker Entry Point
 *
 * This script starts all background workers for processing bulk upload jobs.
 * Run this as a separate process from your main Express server.
 *
 * Usage:
 *   node src/workers/index.js
 *   or
 *   npm run worker
 */

require("dotenv").config();

const mongoose = require("mongoose");
const redisClient = require("../services/queue/redisClient");
const { startPeriodicCleanup } = require("../services/queue/queueManager");

// Import workers
require("./bulkUploadWorker");
require("./chatSessionTimeoutWorker");

// Database connection
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/24hourservice";

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected for workers");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Redis connection
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis connected for workers");
  } catch (error) {
    console.error("❌ Redis connection error:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close Redis connection
    if (redisClient.status === "ready") {
      await redisClient.quit();
      console.log("✅ Redis connection closed");
    }

    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
    }

    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

// Start workers
const startWorkers = async () => {
  try {
    console.log("🚀 Starting 24HourService Background Workers...");
    console.log("📅 Started at:", new Date().toISOString());
    console.log("🔧 Environment:", process.env.NODE_ENV || "development");

    // Connect to databases
    await connectDB();
    await connectRedis();

    // Start periodic cleanup service
    startPeriodicCleanup();

    console.log("\n🎯 Workers are now processing jobs:");
    console.log("   • Mechanics bulk upload");
    console.log("   • Service providers bulk upload");
    console.log("   • Policies bulk upload");
    console.log("   • Chat session timeout monitoring");
    console.log("\n⏰ TTL Features enabled:");
    console.log("   • 3-day job data TTL");
    console.log("   • 1-minute cleanup after completion");
    console.log("   • Periodic cleanup every hour");
    console.log("\n📊 Monitor queues at: /api/v1/queues/stats");
    console.log(
      "🔍 Check job status at: /api/v1/jobs/{queueName}/{jobId}/status"
    );
    console.log("\n✨ Workers ready and waiting for jobs...\n");
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
};

// Start the workers
startWorkers();
