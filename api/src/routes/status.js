// api/src/routes/status.js
import { Router } from "express";
import { db } from "../db.js";

const router = Router();

/**
 * Tijdelijke in-memory status
 * Alleen runtime info van agent (heartbeat / state)
 * Wordt bewust NIET persistent opgeslagen
 */
const STATUS = {};

/**
 * POST /api/status/:boxId
 * Ontvang statusupdates en heartbeats van agent
 * Agent is de enige schrijver van state
 */
router.post("/:boxId", (req, res) => {
  const { boxId } = req.params;

  const {
    shutterState = null,   // open | closed | opening | closing | error
    type = "heartbeat",    // heartbeat | state | startup
    source = "agent",      // agent | simulator
    uptime = null,
    temperature = null
  } = req.body || {};

  const now = new Date().toISOString();

  STATUS[boxId] = {
    boxId,
    online: true,
    shutterState,
    type,
    source,
    uptime,
    temperature,
    lastSeen: now
  };

  console.log("[STATUS]", boxId, STATUS[boxId]);

  res.json({
    ok: true,
    boxId,
    status: STATUS[boxId]
  });
});

/**
 * GET /api/status/:boxId
 * Geeft gecombineerde view voor UI en agent:
 * - status: runtime toestand (agent)
 * - box.desired: intent (Firestore)
 */
router.get("/:boxId", async (req, res) => {
  const { boxId } = req.params;

  const status = STATUS[boxId] ?? null;

  try {
    const boxSnap = await db.collection("boxes").doc(boxId).get();
    const box = boxSnap.exists ? boxSnap.data() : null;

    if (!box) {
      return res.status(404).json({
        ok: false,
        message: "Box niet gevonden"
      });
    }

    res.json({
      ok: true,
      boxId,
      box: {
        desired: box.desired ?? null,
        desiredAt: box.desiredAt ?? null,
        desiredBy: box.desiredBy ?? null
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
 * Overzicht van alle bekende boxen (debug / admin)
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    boxes: Object.values(STATUS)
  });
});

export default router;
