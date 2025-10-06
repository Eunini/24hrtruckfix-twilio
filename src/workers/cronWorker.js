const cron = require("node-cron");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Configuration
const ENDPOINT_URL =
  process.env.CRON_ENDPOINT_URL ||
  "https://two4hourservice-backend.onrender.com/api/v1/cron/process-batches";
const CAMPAIGN_TIMER_URL =
  process.env.CAMPAIGN_TIMER_URL ||
  "https://two4hourservice-backend.onrender.com/api/v1/campaign-timer/process";
const SCHEDULE = "*/2 * * * *"; // Every 2 minutes
const CAMPAIGN_SCHEDULE = "*/10 * * * *"; // Every 10 minutes for campaigns
const WORKER_NAME = "CronBatchProcessor";

/**
 * Background worker to call process-batches endpoint every 2 minutes
 */
class CronWorker {
  constructor() {
    this.isRunning = false;
    this.isCampaignRunning = false;
    this.lastRunTime = null;
    this.lastCampaignRunTime = null;
    this.totalRuns = 0;
    this.totalCampaignRuns = 0;
    this.successfulRuns = 0;
    this.successfulCampaignRuns = 0;
    this.failedRuns = 0;
    this.failedCampaignRuns = 0;
    this.startTime = new Date();
  }

  /**
   * Start the background worker
   */
  start() {
    console.log(`🚀 ${WORKER_NAME} starting...`);
    console.log(`📅 Batch Schedule: ${SCHEDULE} (Every 2 minutes)`);
    console.log(`📅 Campaign Schedule: ${CAMPAIGN_SCHEDULE} (Every 10 minutes)`);
    console.log(`🎯 Batch endpoint: ${ENDPOINT_URL}`);
    console.log(`🎯 Campaign endpoint: ${CAMPAIGN_TIMER_URL}`);
    console.log(`⏰ Started at: ${this.startTime.toISOString()}`);
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    // Schedule the batch processing cron job
    cron.schedule(
      SCHEDULE,
      async () => {
        await this.executeJob();
      },
      {
        scheduled: true,
        timezone: process.env.TZ || "UTC",
      }
    );

    // Schedule the campaign timer cron job
    cron.schedule(
      CAMPAIGN_SCHEDULE,
      async () => {
        await this.executeCampaignTimerJob();
      },
      {
        scheduled: true,
        timezone: process.env.TZ || "UTC",
      }
    );

    // Log worker status every 10 minutes
    cron.schedule("*/10 * * * *", () => {
      this.logStatus();
    });

    console.log(`✅ ${WORKER_NAME} scheduled successfully`);
    console.log(`🔄 Next batch execution in ~2 minutes`);
    console.log(`🔄 Next campaign execution in ~10 minutes`);
  }

  /**
   * Execute the batch processing job
   */
  async executeJob() {
    if (this.isRunning) {
      console.log(
        `⚠️ [${new Date().toISOString()}] Job already running, skipping this execution`
      );
      return;
    }

    this.isRunning = true;
    this.totalRuns++;
    this.lastRunTime = new Date();

    const startTime = Date.now();
    console.log(
      `\n🔄 [${this.lastRunTime.toISOString()}] Starting batch processing (Run #${
        this.totalRuns
      })`
    );

    try {
      // Make the API call
      const response = await fetch(ENDPOINT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${WORKER_NAME}/1.0`,
        },
        timeout: 120000, // 2 minute timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        this.successfulRuns++;

        console.log(
          `✅ [${new Date().toISOString()}] Batch processing completed successfully`
        );
        console.log(`📊 Response time: ${responseTime}ms`);
        console.log(`📈 Results:`, JSON.stringify(result.data, null, 2));

        if (result.data) {
          const { processed, skipped, errors, calls_made } = result.data;
          console.log(`📞 Calls made: ${calls_made || 0}`);
          console.log(`✅ Processed: ${processed || 0}`);
          console.log(`⏭️ Skipped: ${skipped || 0}`);
          console.log(`❌ Errors: ${errors || 0}`);
        }
      } else {
        const errorText = await response.text();
        this.failedRuns++;

        console.error(
          `❌ [${new Date().toISOString()}] Batch processing failed`
        );
        console.error(`🔢 Status: ${response.status} ${response.statusText}`);
        console.error(`📊 Response time: ${responseTime}ms`);
        console.error(`📝 Error response:`, errorText);
      }
    } catch (error) {
      this.failedRuns++;
      const responseTime = Date.now() - startTime;

      console.error(`💥 [${new Date().toISOString()}] Batch processing error`);
      console.error(`📊 Response time: ${responseTime}ms`);
      console.error(`🔍 Error details:`, error.message);

      if (error.code === "ECONNREFUSED") {
        console.error(`🌐 Connection refused - server may be down`);
      } else if (error.code === "ENOTFOUND") {
        console.error(`🔍 DNS lookup failed - check endpoint URL`);
      } else if (error.code === "ETIMEDOUT") {
        console.error(`⏰ Request timed out - server may be overloaded`);
      }
    } finally {
      this.isRunning = false;
      console.log(`🏁 [${new Date().toISOString()}] Job execution completed\n`);
    }
  }

  /**
   * Execute the campaign timer job
   */
  async executeCampaignTimerJob() {
    if (this.isCampaignRunning) {
      console.log(
        `⚠️ [${new Date().toISOString()}] Campaign timer job already running, skipping this execution`
      );
      return;
    }

    this.isCampaignRunning = true;
    this.totalCampaignRuns++;
    this.lastCampaignRunTime = new Date();

    const startTime = Date.now();
    console.log(
      `\n📞 [${this.lastCampaignRunTime.toISOString()}] Starting campaign timer processing (Run #${
        this.totalCampaignRuns
      })`
    );

    try {
      // Make the API call to campaign timer endpoint
      const response = await fetch(CAMPAIGN_TIMER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${WORKER_NAME}/1.0`,
        },
        timeout: 120000, // 2 minute timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        this.successfulCampaignRuns++;

        console.log(
          `✅ [${new Date().toISOString()}] Campaign timer processing completed successfully`
        );
        console.log(`📊 Response time: ${responseTime}ms`);
        console.log(`📈 Results:`, JSON.stringify(result.data, null, 2));

        if (result.data) {
          const { campaignsProcessed, totalProcessed, totalSent, totalErrors } = result.data;
          console.log(`🏢 Campaigns processed: ${campaignsProcessed || 0}`);
          console.log(`📞 Messages sent: ${totalSent || 0}`);
          console.log(`✅ Total processed: ${totalProcessed || 0}`);
          console.log(`❌ Errors: ${totalErrors || 0}`);
        }
      } else {
        const errorText = await response.text();
        this.failedCampaignRuns++;

        console.error(
          `❌ [${new Date().toISOString()}] Campaign timer processing failed`
        );
        console.error(`🔢 Status: ${response.status} ${response.statusText}`);
        console.error(`📊 Response time: ${responseTime}ms`);
        console.error(`📝 Error response:`, errorText);
      }
    } catch (error) {
      this.failedCampaignRuns++;
      const responseTime = Date.now() - startTime;

      console.error(`💥 [${new Date().toISOString()}] Campaign timer processing error`);
      console.error(`📊 Response time: ${responseTime}ms`);
      console.error(`🔍 Error details:`, error.message);

      if (error.code === "ECONNREFUSED") {
        console.error(`🌐 Connection refused - server may be down`);
      } else if (error.code === "ENOTFOUND") {
        console.error(`🔍 DNS lookup failed - check endpoint URL`);
      } else if (error.code === "ETIMEDOUT") {
        console.error(`⏰ Request timed out - server may be overloaded`);
      }
    } finally {
      this.isCampaignRunning = false;
      console.log(`🏁 [${new Date().toISOString()}] Campaign timer job execution completed\n`);
    }
  }

  /**
   * Log worker status and statistics
   */
  logStatus() {
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeMinutes = Math.floor(uptime / (1000 * 60));
    const successRate =
      this.totalRuns > 0
        ? ((this.successfulRuns / this.totalRuns) * 100).toFixed(1)
        : "0.0";
    
    const campaignSuccessRate =
      this.totalCampaignRuns > 0
        ? ((this.successfulCampaignRuns / this.totalCampaignRuns) * 100).toFixed(1)
        : "0.0";

    console.log(
      "\n📊 ═══════════════════════════════════════════════════════════════════════════════"
    );
    console.log(`📈 ${WORKER_NAME} Status Report`);
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log(`⏰ Uptime: ${uptimeMinutes} minutes`);
    
    // Batch processing stats
    console.log(`\n📦 Batch Processing:`);
    console.log(`🔄 Total runs: ${this.totalRuns}`);
    console.log(`✅ Successful: ${this.successfulRuns}`);
    console.log(`❌ Failed: ${this.failedRuns}`);
    console.log(`📊 Success rate: ${successRate}%`);
    console.log(
      `🕐 Last run: ${
        this.lastRunTime ? this.lastRunTime.toISOString() : "Never"
      }`
    );
    console.log(`🔄 Currently running: ${this.isRunning ? "Yes" : "No"}`);
    console.log(`🎯 Target: ${ENDPOINT_URL}`);
    
    // Campaign timer stats
    console.log(`\n📞 Campaign Timer:`);
    console.log(`🔄 Total runs: ${this.totalCampaignRuns}`);
    console.log(`✅ Successful: ${this.successfulCampaignRuns}`);
    console.log(`❌ Failed: ${this.failedCampaignRuns}`);
    console.log(`📊 Success rate: ${campaignSuccessRate}%`);
    console.log(
      `🕐 Last run: ${
        this.lastCampaignRunTime ? this.lastCampaignRunTime.toISOString() : "Never"
      }`
    );
    console.log(`🔄 Currently running: ${this.isCampaignRunning ? "Yes" : "No"}`);
    console.log(`🎯 Target: ${CAMPAIGN_TIMER_URL}`);
    
    console.log(
      "═══════════════════════════════════════════════════════════════════════════════\n"
    );
  }

  /**
   * Graceful shutdown handler
   */
  shutdown() {
    console.log(`\n🛑 ${WORKER_NAME} shutting down gracefully...`);
    this.logStatus();
    console.log(`👋 ${WORKER_NAME} stopped at: ${new Date().toISOString()}`);
    process.exit(0);
  }
}

// Create and start the worker
const worker = new CronWorker();

// Handle graceful shutdown
process.on("SIGINT", () => worker.shutdown());
process.on("SIGTERM", () => worker.shutdown());

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  worker.shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  worker.shutdown();
});

// Start the worker
worker.start();

module.exports = worker;
