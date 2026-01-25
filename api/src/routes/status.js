// api/src/routes/status.js
import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

/**
 * In-memory runtime status
 * Verliest inhoud bij restart, maar is leidend zolang recent
 */
const RUNTIME = Object.create(null);

/* =========================================================
   Helpers
   ========================================================= */

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeShutter(v) {
  const s = norm(v);
  if (!s) return null;
  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";
  if (s === "opening") return "opening";
  if (s === "closing") return "closing";
  if (s === "error") return "error";
  return null;
}

function normalizeDoor(v) {
  const s = norm(v);
  if (!s) return null;
  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";
  return null;
}

function normalizeLock(v) {
  const s = norm(v);
  if (!s) return null;
  if (s === "locked") return "locked";
  if (s === "unlocked") return "unlocked";
  return null;
}

/**
 * Legacy box.state waarde
 * (portal verwacht open / close)
 */
function toLegacyState(shutter) {
  if (shutter === "open") return "open";
  if (shutter === "closed") return "close";
  return null;
}

/* =========================================================
   POST /api/status/:boxId
   ========================================================= */

router.post("/:boxId", async (req, res) => {
  const { boxId } = req.params;
  if (!boxId) {
    return res.status(400).json({ ok: false, message: "boxId ontbreekt" });
  }

  const body = req.body || {};

  // 1️⃣ bepaal shutterState (orde is belangrijk)
  const shutter =
    normalizeShutter(body.shutterState) ??
    normalizeShutter(body.state) ??
    normalizeShutter(body.doorState);

  if (!shutter) {
    return res.status(400).json({
      ok: false,
      message: "Geen geldige shutterState / state ontvangen"
    });
  }

  // 2️⃣ extra velden
  const door = normalizeDoor(body.door);
  const lock = normalizeLock(body.lock);

  const source = typeof body.source === "string" ? body.source : "agent";
  const type = typeof body.type === "string" ? body.type : "state";

  // 3️⃣ timing is ALTIJD server-side
  const now = new Date();
  const nowMs = now.getTime();

  const legacyState = toLegacyState(shutter);

  /* =======================================================
     Runtime cache (leidend voor portal)
     ======================================================= */

  const prev = RUNTIME[boxId] || {};

  RUNTIME[boxId] = {
    boxId,
    shutterState: shutter,
    state: legacyState,
    door: door ?? prev.door ?? null,
    lock: lock ?? prev.lock ?? null,
    source,
    type,
    online: true,
    lastSeenMs: nowMs,
    updatedAt: nowMs
  };

  /* =======================================================
     Firestore (persistente status)
     ======================================================= */

  const statusDoc = {
    shutterState: shutter,
    state: legacyState,
    door: door ?? prev.door ?? null,
    lock: lock ?? prev.lock ?? null,
    source,
    type,
    online: true,
    lastSeen: now,
    lastSeenMs: nowMs,
    updatedAt: now
  };

  try {
    await db.collection("boxes").doc(boxId).set(
      {
        status: statusDoc,

        // BELANGRIJK:
        // box.state wordt enkel gezet op basis van echte status,
        // niet meer door het portal overschreven
        box: {
          state: legacyState
        }
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

/* =========================================================
   GET /api/status/:boxId
   ========================================================= */

router.get("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  try {
    const snap = await db.collection("boxes").doc(boxId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden" });
    }

    const box = snap.data() || {};

    // Runtime heeft altijd voorrang als die bestaat
    const status = RUNTIME[boxId] ?? box.status ?? null;

    return res.json({
      ok: true,
      boxId,
      box: {
        desired: box?.box?.desired ?? null,
        desiredAt: box?.box?.desiredAt ?? null,
        desiredBy: box?.box?.desiredBy ?? null
      },
      status
    });
  } catch (err) {
    console.error("GET /api/status/:boxId fout:", err);
    return res.status(500).json({ ok: false });
  }
});

/* =========================================================
   GET /api/status
   ========================================================= */

router.get("/", (req, res) => {
  return res.json({
    ok: true,
    boxes: Object.values(RUNTIME)
  });
});

export default router;
