import express from "express";
import cors from "cors";

// ------------------------------------------------------
// API routes (Gridbox platform)
// ------------------------------------------------------

// Core platform
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Legacy / bestaande modules
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";

// SMS webhook (Twilio of alternatief)
import smsWebhook from "./routes/smsWebhook.js";

// ------------------------------------------------------
// App setup
// ------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ------------------------------------------------------
// Healthcheck
// ------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "gridbox-api"
  });
});

// ------------------------------------------------------
// Gridbox platform API
// ------------------------------------------------------

// Device lifecycle
app.use("/api/devices", devicesRouter);

// Commands (open / close / ack)
app.use("/api/commands", commandsRouter);

// Status & heartbeat (P4)
app.use("/api/status", statusRouter);

// Configuratie (zoals lichtvertraging)
app.use("/api/config", configRouter);

// Events (logging, acties, later uitbreidbaar)
app.use("/api/events", eventsRouter);

// ------------------------------------------------------
// Bestaande platform functionaliteit
// ------------------------------------------------------

app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// ------------------------------------------------------
// SMS inbound webhook
// ------------------------------------------------------

app.use("/api/sms/inbound", smsWebhook);

// ------------------------------------------------------
// Server start
// ------------------------------------------------------

// Geen expliciete host nodig (Cloud Run / Docker)
app.listen(PORT, () => {
  console.log(`Gridbox API listening on port ${PORT}`);
});
