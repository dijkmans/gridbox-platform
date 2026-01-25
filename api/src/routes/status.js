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

// Legacy mapping voor portal code die "open" / "close" verwacht
function toLegacyState(normalized) {
  if (normalized === "open") return "open";
  if (normalized === "closed") return "close";
  return null;
}

function normalizeDoor(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";

  return s;
}

function normalizeLock(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  if (s === "locked") return "locked";
  if (s === "unlocked") return "unlocked";

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

  // Als er geen nieuwe state meegegeven is, hou vorige bij (in memory)
  const prev = STATUS[boxId]?.shutterState ?? null;
  const normalizedIncoming = normalizeState(shutterStateRaw);
  const shutterState = normalizedIncoming ?? prev;

  const type = safeString(body.type, "heartbeat"); // heartbeat | state | startup
  const source = safeString(body.source, "agent"); // agent | simulator

  // Optionele velden (kunnen uit oude status blijven hangen als je ze niet overschrijft)
  const doorRaw =
    (typeof body.door === "string" ? body.door : null) ??
    (typeof body.doorState === "string" ? body.doorState : null) ??
    null;

  const lockRaw =
    (typeof body.lock === "string" ? body.lock : null) ??
    (typeof body.lockState === "string" ? body.lockState : null) ??
    null;

  const door = normalizeDoor(doorRaw);
  const lock = normalizeLock(lockRaw);

  const lastError =
    body.lastError == null
      ? null
      : typeof body.lastError === "string"
        ? body.lastError
        : JSON.stringify(body.lastError);

  const uptime = body.uptime ?? null;
  const temperature = body.temperature ?? null;

  // simulated: bij agent willen we dit altijd false (oude true mag niet blijven hangen)
  const simulatedIncoming =
    typeof body.simulated === "boolean" ? body.simulated : null;

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();

  // Bij echte agent updates forceren we simulated false
  const simulated = source === "agent" ? false : (simulatedIncoming ?? false);

  const legacyState = shutterState ? toLegacyState(shutterState) : null;

  // Runtime cache
  STATUS[boxId] = {
    boxId,
    online: true,
    simulated,
    door: door ?? null,
    lock: lock ?? null,
    lastError,
    shutterState: shutterState ?? null,
    state: legacyState ?? shutterState ?? null, // compat: sommige code kijkt naar "state"
    type,
    source,
    uptime,
    temperature,
    timestamp: nowIso,
    lastSeen: nowIso,
    lastSeenMs: nowMs
  };

  // Persist naar Firestore (zodat status niet verdwijnt na restart)
  try {
    const statusUpdate = {
      online: true,
      source,
      type,
      uptime,
      temperature,

      // Zorg dat deze altijd vers en correct zijn
      updatedAt: nowDate,
      lastSeen: nowDate,
      lastSeenMs: nowMs,

      // Dit is belangrijk om oude velden te overschrijven
      simulated,
      timestamp: source === "agent" ? nowIso : (typeof body.timestamp === "string" ? body.timestamp : nowIso),

      // Oude velden die soms blijven hangen: forceer ze naar iets dat klopt
      door: door ?? null,
      lock: lock ?? null,
      lastError: lastError ?? null,

      // Deze horen niet in status te blijven hangen
      desired: null,
      desiredAt: null
    };

    // Alleen overschrijven als we effectief een state hebben
    if (shutterState != null) {
      statusUpdate.shutterState = shutterState;
      statusUpdate.state = legacyState ?? shutterState;
    } else {
      // Als er geen nieuwe state is, laat shutterState en state ongemoeid (merge)
      // maar we blijven wel lastSeen, timestamp, simulated enz updaten
    }

    // Extra velden om het portaal "vanzelf" goed te laten starten
    const topLevelUpdate = {
      status: statusUpdate,
      // lastSeenMinutes niet meer hardcoderen (bleef anders voor altijd 0)
      lastSeenMinutes: null
    };

    // legacy: sommige UI kijkt naar box.state ("open"/"close")
    if (legacyState) {
      topLevelUpdate.box = { state: legacyState };
    }

    await db.collection("boxes").doc(boxId).set(topLevelUpdate, { merge: true });
  } catch (err) {
    console.error("STATUS persist fout:", err);
  }

  return res.json({
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

    let status = runtime ?? persisted ?? null;

    if (status && typeof status === "object") {
      const lastSeenIso = toIso(status.lastSeen) ?? toIso(status.updatedAt) ?? null;
      const shutter = status.shutterState ?? null;
      const legacy = status.state ?? (shutter ? toLegacyState(shutter) : null) ?? null;

      status = {
        ...status,
        shutterState: shutter ?? null,
        state: legacy ?? shutter ?? null,
        lastSeen: lastSeenIso
      };
    }

    const desired = box?.box?.desired ?? box?.desired ?? null;
    const desiredAt = box?.box?.desiredAt ?? box?.desiredAt ?? null;
    const desiredBy = box?.box?.desiredBy ?? box?.desiredBy ?? null;

    return res.json({
      ok: true,
      boxId,
      box: { desired, desiredAt, desiredBy },
      status
    });
  } catch (err) {
    console.error("GET /api/status/:boxId fout:", err);
    return res.status(500).json({
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
  return res.json({
    ok: true,
    boxes: Object.values(STATUS)
  });
});

export default router;
