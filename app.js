const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const path = require("path");

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, ".env") });

// Ensure MongoDB URI exists
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

// Import routes
const organizationRoutes = require("./src/routes/organization.routes");
const ticketRoutes = require("./src/routes/ticket.routes");
// const userRoutes = require('./src/routes/user.routes');
const agentRoutes = require("./src/routes/agent.routes");
const fileUploadRoutes = require("./src/routes/file-upload.routes");
const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const taskRoutes = require("./src/routes/task.routes");
const mechanicRoutes = require("./src/routes/mechanic.routes");
const serviceProviderRoutes = require("./src/routes/service-provider.routes");
const policyRoutes = require("./src/routes/policy.routes");
const bulkUploadRoutes = require("./src/routes/bulkUpload.routes");
const webhookRoutes = require("./src/routes/webhook.routes");
const cronJobRoutes = require("./src/routes/cronJob.routes");
const locationRoutes = require("./src/routes/location.routes");
const urlShortenerRoutes = require("./src/routes/urlShortener.routes");
const aiCallActivityRoutes = require("./src/routes/aiCallActivity.routes");
const vapiSettingsRoutes = require("./src/routes/vapiSettings.routes");
const paymentRoutes = require("./src/routes/payment.routes");
const messageRoutes = require("./src/routes/conversation.routes");
const driverRoutes = require("./src/routes/driver.routes");
const driverPolicyRoutes = require("./src/routes/driver-policy.routes");
const driverAssignmentRoutes = require("./src/routes/driver-assignment.routes");
const serviceRoutes = require("./src/routes/service.routes");
const systemRoutes = require("./src/routes/system.routes");
const vehicleClassificationRoutes = require("./src/routes/vehicle-classification.routes");
const mechanicDetailsRoutes = require("./src/routes/mechanic-details.routes");
const kbItemsRoutes = require("./src/routes/kbItems.routes");
const twilioRoutes = require("./src/routes/message.routes");
const widgetRoutes = require("./src/routes/widget.router");
const organizationWidgetRoutes = require("./src/routes/organization-widget.routes");
const chatRoutes = require("./src/routes/chat.router");
const customPromptRoutes = require("./src/routes/customPrompt.router");
const clientCustomPromptRoutes = require("./src/routes/clientCustomPrompt.routes");
const toolsRoutes = require("./src/routes/tools.routes");
// const dnuListRoutes = require('./src/routes/dnu-list.routes');
// const aiActivityRoutes = require('./src/routes/ai-activity.routes');
const googleRoutes = require("./src/routes/google.routes");
const calenderRoutes = require("./src/routes/calender.routes");
const redisDataRoutes = require("./src/routes/redisData.routes");
const campaignsRoutes = require("./src/routes/campaigns.routes");
const processCampaignRoutes = require("./src/routes/process-campaign.routes");
const campaignTimerRoutes = require("./src/routes/campaign-timer.routes");

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
});

// Middleware

app.use((req, res, next) => {
  if (
    (((req.originalUrl.startsWith("/api/v1/chat/threads") &&
      req.method === "POST") ||
      (req.originalUrl.startsWith("/api/v1/chat/threads") &&
        req.method === "OPTIONS")) &&
      !req.originalUrl.endsWith("all")) ||
    (((req.originalUrl.startsWith("/api/v1/call/") && req.method === "POST") ||
      (req.originalUrl.startsWith("/api/v1/call/") &&
        req.method === "OPTIONS" &&
        !req.originalUrl.includes("call_"))) &&
      !req.originalUrl.endsWith("webhook"))
  ) {
    console.log(
      `Current path: ${req.method} --> ${req.path}?${new URLSearchParams(
        req.query
      ).toString()}`
    );
    return cors({
      origin: "*",
    })(req, res, next);
  } else {
    return cors({
      origin: [
        "https://two4hr-new-ui.onrender.com",
        "https://two4hr-new-ui-n450.onrender.com",
        "https://summary-arguably-louse.ngrok-free.app",
        "https://dev.24hrtruckfix.com",
        "http://localhost:4000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://portal.24hrtruckfix.com",
        "https://portal.24hrtruckfix.com",
        "https://dev.drivers.24hrtruckfix.com",
        "https://drivers.24hrtruckfix.com",
        "https://api.openai.com",
      ],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "stripe-signature",
        "Mcp-Session-Id",
      ],
    })(req, res, next);
  }
});

app.use(helmet());
app.use(morgan("combined"));

// Handle Stripe webhooks before other middleware (needs raw body)
app.use(
  "/api/v1/payments/webhooks",
  express.raw({ type: "application/json" }),
  paymentRoutes
);

app.use("/api/v1", fileUploadRoutes);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use("/api/v1/widgets", widgetRoutes);
app.use("/api/v1/organization-widgets", organizationWidgetRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/custom-prompts", customPromptRoutes);
app.use("/api/v1/client-custom-prompts", clientCustomPromptRoutes);
app.use("/api/v1/tools", toolsRoutes);
app.use("/api/v1/redis", redisDataRoutes);

// Mount routes with /api/v1 prefix
app.use("/api/v1", webhookRoutes);
app.use(fileUpload());

app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1", processCampaignRoutes);
app.use("/api/v1", campaignTimerRoutes);

// Apply rate limiting to all routes
app.use(limiter);

app.use("/api/v1", cronJobRoutes);
app.use("/api/v1", locationRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", driverRoutes);
app.use("/api/v1/drivers", driverPolicyRoutes);
app.use("/api/v1", driverAssignmentRoutes);
app.use("/api/v1", serviceRoutes);
app.use("/api/v1", systemRoutes);
app.use("/api/v1", vehicleClassificationRoutes);
app.use("/api/v1", mechanicDetailsRoutes);
app.use("/api/v1/kb-items", kbItemsRoutes);
app.use("/api/v1", organizationRoutes);
app.use("/api/v1", ticketRoutes);
app.use("/api/v1", twilioRoutes);
app.use("/api/v1", policyRoutes);
app.use("/api/v1", agentRoutes);
app.use("/api/v1", taskRoutes);
app.use("/api/v1", messageRoutes);
app.use("/api/v1", mechanicRoutes);
app.use("/api/v1", serviceProviderRoutes);
app.use("/api/v1", bulkUploadRoutes);
app.use("/api/v1/ai-activity-call-activities", aiCallActivityRoutes);
app.use("/api/v1/vapi", vapiSettingsRoutes);
app.use("/api/v1/google", googleRoutes);
app.use("/api/v1/calendar", calenderRoutes);
app.use("/api/v1", campaignsRoutes);
app.use("/", urlShortenerRoutes);
// app.use('/api/v1', aiActivityRoutes);

// Admin routes are mounted at root since they include their full path
app.use("/", adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

let io = null;

// Database connection with proper error handling
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");

    const pipeline = []; // e.g. [{ $match: { "ns.coll": "tickets" } }]
    const changeStream = mongoose.connection.watch(pipeline, {
      fullDocument: "updateLookup",
    });
    changeStream.on("change", (change) => {
      console.log(
        "🔄 ChangeStream:",
        change.operationType,
        change.ns?.coll,
        change.documentKey?._id
      );
      io.emit("db-change", change);
    });

    changeStream.on("error", (err) => {
      console.error("❌ Change stream error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Redis connection
// const redisClient = require('./redisClient');
// redisClient.connect()
//   .then(() => console.log('Connected to Redis'))
//   .catch(err => console.error('Redis connection error:', err));

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`🚀 MCP Server available at: http://localhost:${PORT}/mcp`);
  console.log(`📡 MCP Health check: http://localhost:${PORT}/mcp/health`);
});

io = new Server(server, {
  cors: {
    origin: [
      "https://two4hr-new-ui.onrender.com",
      "https://two4hr-new-ui-n450.onrender.com",
      "https://summary-arguably-louse.ngrok-free.app",
      "https://dev.24hrtruckfix.com",
      "http://localhost:4000",
      "http://localhost:3002",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://portal.24hrtruckfix.com",
      "https://portal.24hrtruckfix.com",
      "https://dev.drivers.24hrtruckfix.com",
      "https://dev.sp-24hrtruckfix.com",
      "https://drivers.24hrtruckfix.com",
      "https://api.openai.com",
    ],
    credentials: true,
  },
});

app.set("io", io);
app.set("trust proxy", 1);

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.on("join", (room) => {
    console.log(`socket ${socket.id} joining room ${room}`);
    socket.join(room);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");

  // Close MCP connections
  const mcpController = require("./src/controllers/mcp.controller");
  await mcpController.closeMCPConnections();

  server.close(() => {
    console.log("📦 Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down server...");

  // Close MCP connections
  const mcpController = require("./src/controllers/mcp.controller");
  await mcpController.closeMCPConnections();

  server.close(() => {
    console.log("📦 Server closed");
    process.exit(0);
  });
});

// module.exports = app;
