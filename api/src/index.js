// api/src/index.js

import express from "express";
import cors from "cors";

// API routers
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Legacy
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";

// ✅ ENIGE SMS ROUTE
import smsRouter from "./routes/sms.js";

const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// Routes
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// ✅ SMS INBOUND
app.use("/api/sms/inbound", smsRouter);

app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});
