// api/src/index.js

import express from "express";
import cors from "cors";

// -----------------------------
// Nieuwe API routers
// -----------------------------
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";
import smsRouter from "./routes/sms.js";

// -----------------------------
// Legacy routers
// -----------------------------
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";

const app = express();

// Cloud Run geeft altijd een PORT mee via env
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

// -----------------------------
// Middleware
// -----------------------------
app.use(cors());

// Twilio stuurt application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// -----------------------------
// Healthcheck
// -----------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// -----------------------------
// Core API routes
// -----------------------------
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

// -----------------------------
// SMS (Twilio)
// -----------------------------
app.use("/api/sms", smsRouter);

// -----------------------------
// Legacy routes (niet breken!)
// -----------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// -----------------------------
// Start server (Cloud Run)
// -----------------------------
app.listen(PORT, HOST, () => {
  console.log(`🚀 Gridbox API running on http://${HOST}:${PORT}`);
});
