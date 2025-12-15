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

// ✅ ENIGE SMS INGANG
import smsWebhook from "./routes/smsWebhook.js";

const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// Nieuwe API Routes
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

// Legacy
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// ✅ SMS webhook (enkel deze)
app.use("/api/sms/inbound", smsWebhook);

app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});
