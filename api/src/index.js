// api/src/index.js

// ------------------------------------------------------
// Imports
// ------------------------------------------------------
const express = require("express");
const cors = require("cors");

// Routers
const boxesRouter = require("./routes/boxes");
const sharesRouter = require("./routes/shares");
const smsRouter = require("./routes/smsWebhook"); // SMS webhook router

// ------------------------------------------------------
// App setup
// ------------------------------------------------------
const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.urlencoded({ extended: false })); // voor Twilio form data
app.use(express.json());

// ------------------------------------------------------
// API KEY SECURITY
// ------------------------------------------------------
const API_KEY = process.env.API_KEY || "DEV_KEY_CHANGE_ME";

function isTwilioRequest(req) {
  const agent = req.headers["user-agent"] || "";
  return agent.includes("Twilio");
}

app.use((req, res, next) => {
  // Healthcheck en Twilio mogen zonder API key
  if (
    req.path === "/api/health" ||
    req.path === "/api/sms-webhook" ||
    isTwilioRequest(req)
  ) {
    return next();
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

// ------------------------------------------------------
// ROUTES
// ------------------------------------------------------

// Eenvoudige healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Box routes
app.use("/api/boxes", boxesRouter);

// Share routes
app.use("/api/shares", sharesRouter);

// SMS webhook route
app.use("/api/sms-webhook", smsRouter);

// ------------------------------------------------------
// Start server
// ------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`Gridbox API luistert op http://${HOST}:${PORT}`);
});

module.exports = app;
