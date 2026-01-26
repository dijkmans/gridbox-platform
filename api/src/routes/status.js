// api/src/routes/status.js
import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

// Kleine normalizer zodat we overal dezelfde strings gebruiken
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
// We bewaren dit WEL in Firestore onder boxes/<boxId>.status
router.post("/:boxId", async (req, res) => {
  const { boxId } = req.params;
  const body = req.body || {};

  const shutterState = normDoor(body.shutterState ?? body.state ?? null);

  const doorRaw = body.door ?? shutterState;
  const door = (doorRaw === "open" || doorRaw === "closed") ? doorRaw : normDoor(doorRaw);

  const statusPatch = {
    // hoofdvelden voor portal
    door: (door === "open" || door === "closed") ? door : null,
    shutterState,
    online: true,
    source: String(body.source ?? "agent"),

    // timing
    lastSeenMs: Date.now(),
    lastSeen: new Date(),
    updatedAt: new Date(),

    // optioneel (handig voor debug)
    type: body.type ?? "heartbeat",
    moving: typeof body.moving === "boolean" ? body.moving : null,
    uptime: Number.isFinite(Number(body.uptime)) ? Number(body.uptime) : null,
    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : null,
    agentVersion: body.agentVersion ?? null,
    deviceId: body.deviceId ?? null,
    agentName: body.agentName ?? null,
    lastError: body.lastError ?? null
  };

  try {
    await db
      .collection("boxes")
      .doc(String(boxId))
      .set({ status: statusPatch }, { merge: true });

    return res.json({ ok: true, boxId, status: statusPatch });
  } catch (e) {
    console.error("POST /api/status/:boxId fout:", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout" });
  }
});

// GET /api/status/:boxId
// Debug view: Firestore status + huidige desired
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
