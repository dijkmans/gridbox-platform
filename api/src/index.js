// api/src/index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Handlers
const { getBoxHandler, listSharesForBoxHandler } = require("./boxes");
const { router: sharesRouter } = require("./shares");

// App setup
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// -------------------------------------------------------------
// 🔐 API KEY SECURITY (GLOBAL MIDDLEWARE)
// -------------------------------------------------------------
const API_KEY = process.env.API_KEY || "DEV_KEY_CHANGE_ME";

function isTwilioRequest(req) {
  // Twilio stuurt NOOIT x-api-key mee
  // Twilio heeft eigen signing, die valideren we later
  const twilioUserAgent = req.headers["user-agent"] || "";
  return twilioUserAgent.includes("Twilio");
}

app.use((req, res, next) => {
  // Twilio webhook moet kunnen binnenkomen zonder API key
  if (req.path === "/api/sms-webhook" || isTwilioRequest(req)) {
    return next();
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

// -------------------------------------------------------------
// 🔍 HEALTHCHECK
// -------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// -------------------------------------------------------------
// 📬 Twilio SMS Webhook (Parsing van OPEN/12, OPSLAAN, ACTIE STUREN)
// -------------------------------------------------------------
app.post("/api/sms-webhook", (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim().toUpperCase();

  console.log("[SMS RECEIVED]", from, body);

  // Basic commands: OPEN 12, CLOSE 12
  const match = body.match(/(OPEN|CLOSE)\s+(\d+)/);
  if (!match) {
    return res.send(`<Response><Message>Ik begrijp uw opdracht niet. Gebruik OPEN 12.</Message></Response>`);
  }

  const action = match[1];
  const boxId = match[2];

  console.log(`[SMS PARSED] Action=${action} Box=${boxId}`);

  // Later koppelen we dit aan Raspberry Pi
  // Voor nu simuleren we enkel een antwoord
  if (action === "OPEN") {
    return res.send(`<Response><Message>Box ${boxId} wordt geopend.</Message></Response>`);
  }

  if (action === "CLOSE") {
    return res.send(`<Response><Message>Box ${boxId} wordt gesloten.</Message></Response>`);
  }
});

// -------------------------------------------------------------
// 📦 BOX ROUTES
// -------------------------------------------------------------
app.get("/api/boxes/:boxId", getBoxHandler);
app.get("/api/boxes/:boxId/shares", listSharesForBoxHandler);

// -------------------------------------------------------------
// 📦 SHARES ROUTES
// -------------------------------------------------------------
app.use("/api/shares", sharesRouter);

// -------------------------------------------------------------
// 🚪 OPEN/CLOSE ENDPOINTS (voor Raspberry Pi)
// -------------------------------------------------------------
app.post("/api/boxes/:boxId/open", (req, res) => {
  const boxId = req.params.boxId;
  console.log(`[CMD] OPEN box ${boxId}`);

  // Later: stuur signaal naar Raspberry Pi
  res.json({ status: "opening", box: boxId });
});

app.post("/api/boxes/:boxId/close", (req, res) => {
  const boxId = req.params.boxId;
  console.log(`[CMD] CLOSE box ${boxId}`);

  // Later: signaal naar Pi
  res.json({ status: "closing", box: boxId });
});

// -------------------------------------------------------------
// 🚀 START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Gridbox API draait op poort ${PORT}`);
});
