// api/src/routes/status.js
import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

/**
 * In-memory status (runtime cache).
 * Extra: we bewaren status ook persistent in Firestore:
 * boxes/<boxId>.status
 */
const STATUS = Object.create(null);

function normalizeState(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  if (s === "close") return "closed";
  if (s === "closed") return "closed";

  if (s === "opened") return "open";
  if (s === "open") return "open";

  if (s === "opening") return "opening";
  if (s === "closing") return "closing";

  if (s === "error") return "error";

  return s;
}

function toIso(v) {
  try {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v.toDate === "function") return v.toDate().toISOString(); // Firestore Timestamp
    if (v instanceof Date) return v.toISOString();
    return null;
  } catch {
    return null;
  }
}

function safeString(v, fallback) {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

/**
 * POST /api/status/:boxId
 * Ontvang statusupdates en heartbeats van agent.
 * Agent is de enige schrijver van state.
 * We slaan op in memory + persistent in Firestore.
 */
router.post("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  if (!boxId) {
    return res.status(400).json({ ok: false, message: "boxId ontbreekt" });
  }

  const body = req.body || {};

  const shutterStateRaw =
    (typeof body.shutterState === "string" ? body.shutterState : null) ??
    (typeof body.state === "string" ? body.state : null) ??
    (typeof body.doorState === "string" ? body.doorState : null) ??
    null;

  const shutterState = normalizeState(shutterStateRaw);

  const type = safeString(body.type, "heartbeat");     // heartbeat | state | startup
  const source = safeString(body.source, "agent");     // agent | simulator
  const uptime = body.uptime ?? null;
  const temperature = body.temperature ?? null;

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();

  // Runtime cache
  STATUS[boxId] = {
    boxId,
    online: true,
    shutterState,
    state: shutterState, // compat voor code die "state" verwacht
    type,
    source,
    uptime,
    temperature,
    lastSeen: nowIso,
    lastSeenMs: nowMs
  };

  // Persist naar Firestore (zodat status niet verdwijnt na restart)
  try {
    await db.collection("boxes").doc(boxId).set(
      {
        status: {
          online: true,
          shutterState,
          state: shutterState, // compat
          updatedAt: nowDate,
          lastSeen: nowDate,   // compat
          lastSeenMs: nowMs,   // handig om later lastSeenMinutes te berekenen
          type,
          source,
          uptime,
          temperature
        }
      },
      { merge: true }
    );
  } catch (err) {
    console.error("STATUS persist fout:", err);
  }

  res.json({
    ok: true,
    boxId,
    status: STATUS[boxId]
  });
});

/**
 * GET /api/status/:boxId
 * Geeft gecombineerde view:
 * - desired: uit Firestore
 * - status: runtime als die bestaat, anders de laatst opgeslagen status uit Firestore
 */
router.get("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  try {
    const boxSnap = await db.collection("boxes").doc(boxId).get();
    const box = boxSnap.exists ? boxSnap.data() : null;

    if (!box) {
      return res.status(404).json({
        ok: false,
        message: "Box niet gevonden"
      });
    }

    const runtime = STATUS[boxId] ?? null;
    const persisted = box.status ?? null;

    // runtime eerst, anders Firestore
    let status = runtime ?? persisted ?? null;

    // Normaliseer output voor de UI
    if (status && typeof status === "object") {
      const lastSeenIso = toIso(status.lastSeen) ?? toIso(status.updatedAt) ?? null;
      const shutter = status.shutterState ?? status.state ?? null;

      status = {
        ...status,
        shutterState: shutter,
        state: shutter,
        lastSeen: lastSeenIso
      };
    }

    // desired zit bij sommige versies top-level, bij andere onder box.*
    const desired = box?.box?.desired ?? box?.desired ?? null;
    const desiredAt = box?.box?.desiredAt ?? box?.desiredAt ?? null;
    const desiredBy = box?.box?.desiredBy ?? box?.desiredBy ?? null;

    res.json({
      ok: true,
      boxId,
      box: {
        desired,
        desiredAt,
        desiredBy
      },
      status
    });
  } catch (err) {
    console.error("GET /api/status/:boxId fout:", err);
    res.status(500).json({
      ok: false,
      message: "Interne serverfout"
    });
  }
});

/**
 * GET /api/status
 * Debug: toont enkel in-memory status (runtime)
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    boxes: Object.values(STATUS)
  });
});

export default router;
