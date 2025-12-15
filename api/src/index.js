// api/src/index.js
import express from "express";
import cors from "cors";

// Nieuwe API routers (laat staan als jij ze hebt)
import devicesRouter from "./routes/devices.js";
import commandsRouter from "./routes/commands.js";
import statusRouter from "./routes/status.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";

// Legacy routers (laat staan als jij ze hebt)
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";

// BELANGRIJK: gebruik deze
import smsRouter from "./routes/sms.js";

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

// SMS webhook
app.use("/api/sms", smsRouter);

app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});
