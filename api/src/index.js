// api/src/index.js
import express from "express";
import cors from "cors";

// Nieuwe routers (hoofdsysteem)
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Legacy routers (blijven werken tot migratie klaar is)
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";
import smsRouter from "./routes/smsWebhook.js";

const app = express();

// Cloud Run vereist luisteren op alle interfaces
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ------------------------------------------------------
// Healthcheck (vereist voor Cloud Run)
// ------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// ------------------------------------------------------
// Nieuwe API Routes (de toekomst van Gridbox API)
// ------------------------------------------------------
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

// ------------------------------------------------------
// Legacy routes (tijdelijk blijven bestaan)
// ------------------------------------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/sms-webhook", smsRouter);

// ------------------------------------------------------
// Start Server — Cloud Run compatible
// ------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`🚀 Gridbox API running at http://${HOST}:${PORT}`);
});
