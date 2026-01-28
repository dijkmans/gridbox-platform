// api/src/index.js

import express from "express";
import cors from "cors";

import { db } from "./firebase.js";

import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";
import captureRouter from "./routes/capture.js";
import orgBoxDeviceRouter from "./routes/orgBoxDevice.js";

// --------------------------------------------------
// App + port (VERPLICHT voor Cloud Run)
// --------------------------------------------------
const app = express();
const PORT = Number(process.env.PORT) || 8080;

// --------------------------------------------------
// Startup logging (belangrijk voor Cloud Run logs)
// --------------------------------------------------
console.log("🚀 Gridbox API starting...");
console.log("🌍 Environment:", process.env.NODE_ENV || "unknown");
console.log("🔌 Listening port:", PORT);

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Seq",
    "X-Phase",
    "X-Timestamp"
  ]
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// --------------------------------------------------
// Healthcheck (MOET supersnel antwoorden)
// --------------------------------------------------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "gridbox-api",
    ts: Date.now()
  });
});

// --------------------------------------------------
// Debug Firestore
// --------------------------------------------------
app.get("/api/_debug/firestore", async (req, res) => {
  try {
    const snap = await db.collection("boxes").limit(1).get();
    res.json({ ok: true, count: snap.size });
  } catch (err) {
    console.error("❌ Firestore debug error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// --------------------------------------------------
// Bird webhook
// --------------------------------------------------
app.post("/webhooks/bird", async (req, res) => {
  try {
    console.log("📩 Bird webhook ontvangen");
    console.log(JSON.stringify(req.body, null, 2));

    const text = req.body?.body?.text?.text?.trim() || "";
    const from =
      req.body?.receiver?.contacts?.[0]?.identifierValue || "unknown";

    if (!text) {
      return res.json({ ok: true, action: "empty" });
    }

    const match = text.match(/open\s+(\d+)/i);
    if (!match) {
      return res.json({ ok: true, action: "ignored" });
    }

    const boxId = match[1];
    const boxRef = db.collection("boxes").doc(String(boxId));
    const snap = await boxRef.get();

    if (!snap.exists) {
      console.warn("⚠️ Box niet gevonden:", boxId);
      return res.json({ ok: false, message: "Box niet gevonden", boxId });
    }

    await boxRef.set({
      box: {
        desired: "open",
        desiredAt: new Date()
      },
      lastCommand: {
        source: "sms",
        from,
        text,
        at: new Date()
      }
    }, { merge: true });

    console.log(`✅ Box ${boxId} -> OPEN`);

    res.json({ ok: true, action: "open", boxId });

  } catch (err) {
    console.error("❌ Bird webhook fout:", err);
    res.status(500).json({ ok: false });
  }
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function normAction(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (!s || s === "null" || s === "none") return null;
  if (s === "open") return "open";
  if (s === "close") return "close";
  return null;
}

function toMillis(v) {
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

// --------------------------------------------------
// Routes
// --------------------------------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/internal", internalJobsRouter);

// capture
app.use("/api/boxes/:boxId/capture", captureRouter);
app.use("/api/orgs/:orgId/boxes/:boxId/capture", captureRouter);

// device
app.use("/api/boxes/:boxId/device", orgBoxDeviceRouter);
app.use("/api/orgs/:orgId/boxes/:boxId/device", orgBoxDeviceRouter);

// --------------------------------------------------
// 404 fallback
// --------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route niet gevonden",
    path: req.originalUrl
  });
});

// --------------------------------------------------
// START SERVER (CRUCIAAL VOOR CLOUD RUN)
// --------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Gridbox API live op poort ${PORT}`);
});
