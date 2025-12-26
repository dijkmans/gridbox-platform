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

// helper: haal desired uit Firestore
// BELANGRIJK: alleen Portal.box.desired telt
function pickDesired(data) {
  const v = data?.Portal?.box?.desired;
  return typeof v === "string" ? v : null;
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

    const desired = pickDesired(found.data);

    return res.json({
      ok: true,
      boxId,
      desired,
      source: found.path
    });
  } catch (e) {
    console.error("GET /api/boxes/:boxId/desired error:", e);
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
});

// POST ack (Pi zegt: uitgevoerd, wis Portal.box.desired velden)
app.post("/api/boxes/:boxId/desired/ack", async (req, res) => {
  try {
    const { boxId } = req.params;

    const found = await findBoxDoc(boxId);
    if (!found) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden", boxId });
    }

    await found.ref.update({
      "Portal.box.desired": null,
      "Portal.box.desiredAt": null,
      "Portal.box.desiredBy": null
    });

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
