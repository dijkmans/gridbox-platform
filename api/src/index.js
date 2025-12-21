// api/src/index.js

import express from "express";
import cors from "cors";

import { db } from "./firebase.js";

import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";

// device endpoints (poll commands + result + status)
import orgBoxDeviceRouter from "./routes/orgBoxDevice.js";

const app = express();
const PORT = process.env.PORT || 8080;

// middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// debug: test Firestore connectie lokaal
app.get("/api/_debug/firestore", async (req, res) => {
  try {
    const snap = await db.collection("boxes").limit(1).get();
    res.json({ ok: true, count: snap.size });
  } catch (e) {
    console.error("DEBUG firestore error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// routes
app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/internal", internalJobsRouter);

// device routes
// zonder org (legacy)
app.use("/api/boxes/:boxId/device", orgBoxDeviceRouter);
// met org (nieuwer pad)
app.use("/api/orgs/:orgId/boxes/:boxId/device", orgBoxDeviceRouter);

// fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Route niet gevonden" });
});

// start
app.listen(PORT, () => {
  console.log("🚀 Gridbox API gestart op poort", PORT);
});
