import express from "express";
import cors from "cors";

// Nieuwe routers (ESM, future-proof)
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Oude routers (blijven werken zolang jij wil)
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";
import smsRouter from "./routes/smsWebhook.js";

const app = express();

const PORT = process.env.PORT || 8080;

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
// Nieuwe API Routes (vanaf nu de toekomst)
// ------------------------------------------------------
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

// ------------------------------------------------------
// Legacy routes (blijven werken tot we ze vervangen)
// ------------------------------------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/sms-webhook", smsRouter);

// ------------------------------------------------------
// Start Server — Cloud Run compatible
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Gridbox API running on port ${PORT}`);
});
