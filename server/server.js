require("dotenv").config();
const express = "express"; // Wait, keep require("express") properly:
const expressApp = require("express");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { processUnreadEmails, getAccessToken } = require("./services/emailService");

const app = expressApp();
const PORT = process.env.PORT || 3000;

app.use(expressApp.json());

// Main Connection & Server Setup
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully.");

    app.listen(PORT, () => {
      console.log(`Control Tower server running on http://localhost:${PORT}`);

      // Trigger initial scan immediately on startup
      processUnreadEmails();

      // Schedule cron job:
      // Note: Standard standard cron doesn't natively support seconds unless using a 6-field pattern.
      // '*/5 * * * * *' means run every 5 seconds using node-cron.
      cron.schedule("*/5 * * * * *", () => {
        processUnreadEmails();
      });

      console.log("[Worker] Email polling cron job initialized (runs every 5 seconds).");
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });

// ============================================
// API Endpoints
// ============================================

app.get("/", (req, res) => {
  res.json({ success: true, message: "Control Tower API is running." });
});

app.get("/test-connection", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    res.json({
      success: true,
      message: "Microsoft Graph connection successful.",
      tokenReceived: !!accessToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Microsoft Graph connection failed.",
      error: error.message,
    });
  }
});