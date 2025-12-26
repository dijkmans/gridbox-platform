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

// helpers
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

  // Firestore Timestamp heeft meestal toMillis()
  if (typeof v?.toMillis === "function") return v.toMillis();

  // Date object
  if (v instanceof Date) return v.getTime();

  // number
  if (typeof v === "number") return v;

  // string (ISO)
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

// BELANGRIJK:
// box.desired = doelstand (blijft staan)
// box.state = huidige stand (blijft staan)
// API endpoint /desired geeft enkel "desired" terug als er nog iets te doen is
function computeDesiredForPi(data) {
  const box = pickBox(data);

  const target = normAction(box.desired);
  const state = normAction(box.state);

  // niets gevraagd
  if (!target) return { target: null, state, desired: null, reason: "no_target" };

  // als state al gelijk is aan target, dan is er niks te doen
  if (state && state === target) {
    return { target, state, desired: null, reason: "already_in_state" };
  }

  // extra beveiliging: als desiredAt niet nieuwer is dan lastAppliedAt, dan niet opnieuw sturen
  const desiredAtMs = toMillis(box.desiredAt);
  const lastAppliedAtMs = toMillis(box.lastAppliedAt) ?? toMillis(data?.lastAckAt);

  if (desiredAtMs && lastAppliedAtMs && desiredAtMs <= lastAppliedAtMs) {
    return { target, state, desired: null, reason: "already_applied_by_time" };
  }

  // anders: Pi moet dit uitvoeren
  return { target, state, desired: target, reason: "pending" };
}

// helper: vind box doc (primary boxes, daarna fallback)
async function findBoxDoc(boxId) {
  const tries = [
    db.collection("boxes").doc(boxId),
    db.collection("portals").doc(boxId),
    db.collection("Portal").doc(boxId),
    db.collection("devices").doc(boxId)
  ];

  for (const ref of tries) {
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data(), path: ref.path };
  }
  return null;
}

// ------------------------------------------------------------
// PI desired endpoints
// ------------------------------------------------------------

// GET desired (Pi kan pollen)
app.get("/api/boxes/:boxId/desired", async (req, res) => {
  try {
    const { boxId } = req.params;

    const found = await findBoxDoc(boxId);
    if (!found) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden", boxId });
    }

    const r = computeDesiredForPi(found.data);

    return res.json({
      ok: true,
      boxId,
      // dit is het commando voor de Pi (alleen als er nog iets te doen is)
      desired: r.desired,
      // dit blijft staan ter info (doelstand)
      target: r.target,
      // dit blijft staan ter info (huidige stand, als aanwezig)
      state: r.state,
      reason: r.reason,
      source: found.path
    });
  } catch (e) {
    console.error("GET /api/boxes/:boxId/desired error:", e);
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});

// POST ack (Pi zegt: uitgevoerd)
// we wissen box.desired NIET meer
// we zetten box.state + box.lastAppliedAt zodat Pi niet blijft herhalen
app.post("/api/boxes/:boxId/desired/ack", async (req, res) => {
  try {
    const { boxId } = req.params;
    const action = normAction(req.body?.action ?? null);

    const found = await findBoxDoc(boxId);
    if (!found) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden", boxId });
    }

    await found.ref.set(
      {
        box: {
          state: action, // huidige stand
          lastAppliedAt: new Date() // timestamp
        },
        lastAckAt: new Date().toISOString(),
        lastAck: action
      },
      { merge: true }
    );

    return res.json({ ok: true, boxId });
  } catch (e) {
    console.error("POST /api/boxes/:boxId/desired/ack error:", e);
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});

// ------------------------------------------------------------
// routes
// ------------------------------------------------------------
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
