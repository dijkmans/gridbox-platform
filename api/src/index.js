import express from "express";
import cors from "cors";

// routes
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";
import smsWebhook from "./routes/smsWebhook.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// API routes
app.use("/api/devices", devicesRouter);
app.use("/api/commands", commandsRouter);
app.use("/api/status", statusRouter);
app.use("/api/config", configRouter);
app.use("/api/events", eventsRouter);

app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// SMS webhook
app.use("/api/sms/inbound", smsWebhook);

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
