// api/src/routes/status.js
import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

// Normalizer: we willen overal dezelfde strings
function normDoor(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  if (s === "open" || s === "opened") return "open";
  if (s === "close" || s === "closed") return "closed";

  if (s === "opening") return "opening";
  if (s === "closing") return "closing";
  if (s === "error") return "error";

  return s;
}

// POST /api/status/:boxId
// Agent stuurt heartbeat/state updates.
// We bewaren dit in Firestore onder boxes/<boxId>.status
router.post("/:boxId", async (req, res) => {
  const { boxId } = req.params;
  const body = req.body || {};

  // Compat: oude agent stuurt state als object: {door, motion, since}
  const stateObj = body.state && typeof body.state === "object" ? body.state : null;

  const doorRaw =
    body.door ??
    stateObj?.door ??
    body.status?.door ??
    null;

  const motionRaw =
    body.shutterState ??
    body.motion ??
    stateObj?.motion ??
    stateObj?.shutterState ??
    null;

  // shutterState is: opening/closing/open/closed (voor UI animatie)
  const shutterState = normDoor(motionRaw ?? doorRaw ?? null);

  // door is: alleen open/closed (de waarheid voor "rolluik open/dicht")
  const doorNorm = normDoor(doorRaw ?? shutterState ?? null);
  const door = (doorNorm === "open" || doorNorm === "closed") ? doorNorm : null;

  const deviceObj = body.device && typeof body.device === "object" ? body.device : null;

  const statusPatch = {
    door,
    shutterState,
    online: true,
    source: String(body.source ?? "agent"),

    lastSeenMs: Date.now(),
    lastSeen: new Date(),
    updatedAt: new Date(),

    type: body.type ?? "heartbeat",
    moving: typeof body.moving === "boolean" ? body.moving : (shutterState === "opening" || shutterState === "closing"),
    uptime: Number.isFinite(Number(body.uptime)) ? Number(body.uptime) : null,
    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : null,

    // Device info (compat oud en nieuw)
    agentVersion: body.agentVersion ?? deviceObj?.version ?? null,
    deviceId: body.deviceId ?? deviceObj?.deviceId ?? null,
    agentName: body.agentName ?? deviceObj?.agentName ?? null,
    hardwareProfile: body.hardwareProfile ?? deviceObj?.hardwareProfile ?? null,

    lastError: body.lastError ?? null
  };

  try {
    await db.collection("boxes").doc(String(boxId)).set(
      { status: statusPatch },
      { merge: true }
    );

    return res.json({ ok: true, boxId, status: statusPatch });
  } catch (e) {
    console.error("POST /api/status/:boxId fout:", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout" });
  }
});

// GET /api/status/:boxId (debug)
router.get("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  try {
    const snap = await db.collection("boxes").doc(String(boxId)).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, message: "Box niet gevonden" });
    }

    const data = snap.data() || {};
    const desired = data?.box?.desired ?? null;
    const desiredAt = data?.box?.desiredAt ?? null;
    const desiredBy = data?.box?.desiredBy ?? null;

    return res.json({
      ok: true,
      boxId,
      box: { desired, desiredAt, desiredBy },
      status: data?.status ?? null
    });
  } catch (e) {
    console.error("GET /api/status/:boxId fout:", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout" });
  }
});

export default router;
