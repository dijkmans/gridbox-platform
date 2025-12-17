import express from "express";
import cors from "cors";

import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";

const app = express();
const PORT = process.env.PORT || 8080;

// middleware
app.use(cors());
app.use(express.json());

// healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// routes
app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/internal", internalJobsRouter);

// fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Route niet gevonden" });
});

// ⚠️ ALTIJD listen, nooit blokkeren
app.listen(PORT, () => {
  console.log("🚀 Gridbox API gestart op poort", PORT);
});
