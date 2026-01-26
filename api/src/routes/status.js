import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

function norm(v) {
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

// POST /api/status/:boxId
router.post("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;
    const body = req.body || {};

    const stateObj = (body.state && typeof body.state === "object") ? body.state : null;
    const statusObj = (body.status && typeof body.status === "object") ? body.status : null;

    const doorRaw =
      body.door ??
      stateObj?.door ??
      statusObj?.door ??
      statusObj?.state ??     // legacy
      body.state ??           // legacy: state is string
      null;

    const shutterRaw =
      body.shutterState ??
      body.motion ??
      stateObj?.motion ??
      stateObj?.shutterState ??
      statusObj?.shutterState ??
      null;

    const shutterState = norm(shutterRaw ?? doorRaw ?? null);

    let door = norm(doorRaw ?? shutterState ?? null);
    if (door !== "open" && door !== "closed") door = null;

    const statusPatch = {
      door,
      shutterState,
      online: true,
      source: String(body.source ?? "agent"),

      lastSeenMs: Date.now(),
      lastSeen: new Date(),
      updatedAt: new Date(),

      type: body.type ?? "heartbeat",
      moving: typeof body.moving === "boolean"
        ? body.moving
        : (shutterState === "opening" || shutterState === "closing"),

      uptime: Number.isFinite(Number(body.uptime)) ? Number(body.uptime) : null,
      temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : null,

      agentVersion: body.agentVersion ?? null,
      deviceId: body.deviceId ?? null,
      agentName: body.agentName ?? null,
      hardwareProfile: body.hardwareProfile ?? null,

      lastError: body.lastError ?? null
    };

    await db.collection("boxes").doc(String(boxId)).set(
      { status: statusPatch },
      { merge: true }
    );

    return res.json({ ok: true, boxId, status: statusPatch });
  } catch (e) {
    console.error("POST /api/status/:boxId error:", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout" });
  }
});

// GET /api/status/:boxId (handig om te debuggen)
router.get("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;
    const snap = await db.collection("boxes").doc(String(boxId)).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: "Box niet gevonden" });
    return res.json({ ok: true, boxId, status: (snap.data() || {}).status || null });
  } catch (e) {
    console.error("GET /api/status/:boxId error:", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout" });
  }
});

export default router;
