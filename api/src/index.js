// api/src/index.js

// ------------------------------------------------------
// Imports
// ------------------------------------------------------
const express = require("express");
const cors = require("cors");

// Routers
// Belangrijk: juiste paden naar de map "routes"
const boxesRouter = require("./routes/boxes");
const sharesRouter = require("./routes/shares");

// ------------------------------------------------------
// App setup
// ------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ------------------------------------------------------
// API KEY SECURITY (GLOBAL MIDDLEWARE)
// ------------------------------------------------------
const API_KEY = process.env.API_KEY || "DEV_KEY_CHANGE_ME";

function isTwilioRequest(req) {
  const agent = req.headers["user-agent"] || "";
  return agent.includes("Twilio");
}

app.use((req, res, next) => {
  // Twilio mag zonder API key
  if (req.path === "/api/sms-webhook" || isTwilioRequest(req)) {
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

// Healthcheck endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// BOX routes (openen, sluiten, shares, lijst ophalen)
app.use("/api/boxes", boxesRouter);

// SHARE routes (create + verify)
app.use("/api/shares", sharesRouter);

// ------------------------------------------------------
// Start server
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Gridbox API luistert op poort ${PORT}`);
});
