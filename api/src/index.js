// api/src/index.js

// ------------------------------------------------------
// Imports
// ------------------------------------------------------
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Handlers
const { getBoxHandler, listSharesForBoxHandler } = require("./boxes");
const { router: sharesRouter } = require("./shares");

// ------------------------------------------------------
// App setup
// ------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ------------------------------------------------------
// API KEY SECURITY (GLOBAL MIDDLEWARE)
// ------------------------------------------------------
const API_KEY = process.env.API_KEY || "DEV_KEY_CHANGE_ME";

// detecteer of het verzoek van Twilio komt (geen API-key vereist)
function isTwilioRequest(req) {
  const agent = req.headers["user-agent"] || "";
  return agent.includes("Twilio");
}

app.use((req, res, next) => {
  // Twilio webhooks mogen zonder API-key
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

// Healthcheck (voor Cloud Run, monitoring, curl-tests)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// BOX INFO
app.get("/api/boxes/:boxId", getBoxHandler);

// SHARES VAN ÉÉN BOX OPVRAGEN
app.get("/api/boxes/:boxId/shares", listSharesForBoxHandler);

// SHARE OPERATIES (POST /api/shares en /api/shares/verify)
app.use("/api/shares", sharesRouter);

// ------------------------------------------------------
// NIEUWE ROUTE: BOX OPENEN
// ------------------------------------------------------
app.post("/api/boxes/:boxId/open", (req, res) => {
  const boxId = req.params.boxId;

  console.log(`Box ${boxId} OPEN triggered via API`);

  // TODO:
  // hier koppelen we latere logica toe:
  // - via Twilio SMS Raspberry Pi laten openen
  // - direct een webhook naar de Pi sturen
  // - via MQTT een "open" opdracht versturen
  // Voor nu sturen we gewoon een bevestiging terug.

  res.json({
    success: true,
    action: "open_box",
    boxId
  });
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Gridbox API luistert op poort ${PORT}`);
});
