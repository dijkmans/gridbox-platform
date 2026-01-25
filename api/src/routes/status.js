// api/src/routes/status.js
import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

/**
 * In-memory runtime cache
 * Verdwijnt bij restart (Cloud Run)
 */
const RUNTIME = Object.create(null);

/* =========================
   Helpers
   ========================= */

function normalizeShutter(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";
  if (s === "opening") return "opening";
  if (s === "closing") return "closing";
  if (s === "error") return "error";
  return null;
}

function toLegacyState(shutter) {
  if (shutter === "open") return "open";
  if (shutter === "closed") return "close";
  return null;
}

function normalizeDoor(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";
  return null;
}

function normalizeLock(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "locked") return "locked";
  if (s === "unlocked") return "unlocked";
  return null;
}

/* =========================
   POST /api/status/:boxId
   ========================= */

router.post("/:boxId", async (req, res) => {
  const { boxId } = req.params;
  if (!boxId) {
    return res.status(400).json({ ok: false, message: "boxId ontbreekt" });
  }

  const body = req.body || {};

  const shutter =
    normalizeShutter(body.shutterState) ??
    normalizeShutter(body.state) ??
    normalizeShutter(body.doorState);

  if (!shutter) {
    return res.status(400).json({
      ok: false,
      message: "Geen geldige shutterState ontvangen"
    });
  }

  const legacyState = toLegacyState(shutter);
  const door = normalizeDoor(body.door);
  const lock = normalizeLock(body.lock);

  const source = typeof body.source === "string" ? body.source : "agent";
  const type = typeof body.type === "string" ? body.type : "state";

  const now = new Date();
  const nowMs = now.getTime();

  /* ---------- Runtime cache ---------- */

  RUNTIME[boxId] = {
    boxId,
    online: true,
    shutterState: shutter,
    state: legacyState,       // 🔴 essentieel voor portal
    door,
    lock,
    source,
    type,
    lastSeen: now.toISOString(),
    lastSeenMs: nowMs
  };

  /* ---------- Firestore (bron van waarheid) ---------- */

  const statusDoc = {
    online: true,
    shutterState: shutter,
    state: legacyState,       // 🔴 essentieel
    door: door ?? null,
    lock: lock ?? null,
    source,
    type,
    lastSeen: now,
    lastSeenMs: nowMs,
    updatedAt: now
  };

  try {
    await db.collection("boxes").doc(boxId).set(
      {
        status: statusDoc,

        // 🔴 ZORGT DAT HET PORTAAL OPEN BLIJFT
        box: {
          state: legacyState
        },

        // legacy veld niet laten “plakken”
        lastSeenMinutes: null
      },
      { merge: true }
    );
  } catch (err) {
    console.error("STATUS Firestore write fout:", err);
    return res.status(500).json({ ok: false });
  }

  return res.json({
    ok: true,
    boxId,
    status: RUNTIME[boxId]
  });
});

/* =========================
   GET /api/status/:boxId
   ========================= */

router.get("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  try {
    const snap = await db.collection("boxes").doc(boxId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden" });
    }

    const data = snap.data();

    const status =
      RUNTIME[boxId] ??
      data.status ??
      null;

    return res.json({
      ok: true,
      boxId,
      box: {
        desired: data?.box?.desired ?? null,
        desiredAt: data?.box?.desiredAt ?? null,
        desiredBy: data?.box?.desiredBy ?? null
      },
      status
    });
  } catch (err) {
    console.error("GET /api/status/:boxId fout:", err);
    return res.status(500).json({ ok: false });
  }
});

/* =========================
   GET /api/status
   ========================= */

router.get("/", (req, res) => {
  return res.json({
    ok: true,
    boxes: Object.values(RUNTIME)
  });
});

export default router;
