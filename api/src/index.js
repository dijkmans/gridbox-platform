// api/src/index.js
import express from "express";
import cors from "cors";

// Nieuwe API routers
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Legacy routers
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";
import smsRouter from "./routes/smsWebhook.js";

const app = express();

// Cloud Run geeft altijd een PORT mee via env
const PORT = process.env.PORT || 8080;

// Nodig zodat Cloud Run het proces kan bereiken
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ------------------------------------------------------
// Healthcheck
// ------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// ------------------------------------------------------
// Nieuwe API Routes
// ------------------------------------------------------
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

// ------------------------------------------------------
// Legacy routes
// ------------------------------------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/sms-webhook", smsRouter);

// ------------------------------------------------------
// Start server (Cloud Run-compatible)
// ------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`🚀 Gridbox API running on http://${HOST}:${PORT}`);
});
