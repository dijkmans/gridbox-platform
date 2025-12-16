// api/src/index.js
import express from "express";
import cors from "cors";

// Legacy routes (blijven bestaan)
import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";

// Nieuwe route voor simulator device flow (v1.2.1)
import orgBoxDeviceRouter from "./routes/orgBoxDevice.js";

const app = express();

// Cloud Run geeft altijd een PORT mee via env
const PORT = process.env.PORT || 8080;

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------

app.use(cors());
app.options("*", cors());

app.use(express.json({ limit: "1mb" }));
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
// Routes
// ------------------------------------------------------

// ✅ Nieuwe device flow (simulator en later Raspberry Pi)
// Voorbeeld:
// /api/orgs/powergrid/boxes/box-sim-001/status
// /api/orgs/powergrid/boxes/box-sim-001/commands
app.use("/api/orgs/:orgId/boxes/:boxId", orgBoxDeviceRouter);

// Legacy routes (tijdelijk blijven bestaan, maar nieuwe features hier liefst niet meer bijzetten)
app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);
app.use("/api/shares", sharesRouter);

// Interne jobs (waarschuwingen, later cleanup, enz.)
app.use("/api/internal", internalJobsRouter);

// ------------------------------------------------------
// Fallback 404
// ------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route niet gevonden"
  });
});

// ------------------------------------------------------
// Error handler (zodat onverwachte errors netjes JSON geven)
// ------------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    message: "Interne serverfout"
  });
});

// ------------------------------------------------------
// Start
// ------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Gridbox API gestart");
  console.log(`📡 Luistert op poort ${PORT}`);
});
