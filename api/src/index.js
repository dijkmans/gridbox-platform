// api/src/index.js

import express from "express";
import cors from "cors";

import { db } from "./firebase.js";

import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";

// NEW: capture endpoints (camera frames)
import captureRouter from "./routes/capture.js";

// device endpoints (poll commands + result + status)
import orgBoxDeviceRouter from "./routes/orgBoxDevice.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --------------------------------------------------
// middleware
// --------------------------------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Seq",
      "X-Phase",
      "X-Timestamp"
    ]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --------------------------------------------------
// healthcheck
// --------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

// --------------------------------------------------
// DEBUG
// --------------------------------------------------
app.get("/api/_debug/firestore", async (req, res) => {
  try {
    const snap = await db.collection("boxes").limit(1).get();
    res.json({ ok: true, count: snap.size });
  } catch (e) {
    console.error("DEBUG firestore error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --------------------------------------------------
// BIRD WEBHOOK (NIEUW)
// --------------------------------------------------
app.post("/webhooks/bird", async (req, res) => {
  try {
    console.log("📩 Bird webhook ontvangen");
    console.log(JSON.stringify(req.body, null, 2));

    const text =
      req.body?.body?.text?.text?.trim() || "";

    const from =
      req.body?.receiver?.contacts?.[0]?.identifierValue || "unknown";

    console.log("Van:", from);
    console.log("Tekst:", text);

    // Verwacht: OPEN 5
    const match = text.match(/open\s+(\d+)/i);

    if (!match) {
      return res.json({ ok: true, action: "ignored" });
    }

    const boxId = match[1];

    // Zoek box
    const boxRef = db.collection("boxes").doc(boxId);
    const snap = await boxRef.get();

    if (!snap.exists) {
      console.warn("Box niet gevonden:", boxId);
      return res.json({ ok: false, message: "Box niet gevonden", boxId });
    }

    // Zet desired = open
    await boxRef.set(
      {
        box: {
          desired: "open",
          desiredAt: new Date()
        },
        lastCommand: {
          source: "sms",
          from,
          text
        }
      },
      { merge: true }
    );

    console.log(`✅ Box ${boxId} op OPEN gezet`);

    return res.json({
      ok: true,
      action: "open",
      boxId
    });

  } catch (err) {
    console.error("❌ Bird webhook fout:", err);
    res.status(500).json({ ok: false });
  }
});

// --------------------------------------------------
// helpers
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

function pickBox(data) {
  const b = data?.box;
  return b && typeof b === "object" ? b : {};
}

function computeDesiredForPi(data) {
  const box = pickBox(data);

  const target = normAction(box.desired);
  const state = normAction(box.state);

  if (!target) return { target: null, state, desired: null, reason: "no_target" };

  if (state && state === target) {
    return { target, state, desired: null, reason: "already_in_state" };
  }

  const desiredAtMs = toMillis(box.desiredAt);
  const lastAppliedAtMs =
    toMillis(box.lastAppliedAt) ?? toMillis(data?.lastAckAt);

  if (desiredAtMs && lastAppliedAtMs && desiredAtMs <= lastAppliedAtMs) {
    return { target, state, desired: null, reason: "already_applied_by_time" };
  }

  return { target, state, desired: target, reason: "pending" };
}

// --------------------------------------------------
// routes
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

// fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Route niet gevonden" });
});

// start
app.listen(PORT, () => {
  console.log("🚀 Gridbox API gestart op poort", PORT);
});
