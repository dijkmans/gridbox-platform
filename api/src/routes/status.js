// api/src/routes/status.js
import { Router } from "express";

const router = Router();

// Tijdelijke in-memory opslag
// Wordt later vervangen door Firestore
const STATUS = {};

/**
 * POST /api/status/:boxId
 * Ontvang statusupdates en heartbeats van agent (simulator of Raspberry Pi)
 */
router.post("/:boxId", (req, res) => {
  const { boxId } = req.params;

  const {
    shutterState = null,   // OPEN | CLOSED | OPENING | CLOSING
    type = "heartbeat",    // heartbeat | state | startup
    source = "agent",      // agent | simulator | manual
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

  console.log("STATUS update:", STATUS[boxId]);

  res.json({
    ok: true,
    boxId,
    status: STATUS[boxId]
  });
});

/**
 * GET /api/status/:boxId
 * Status opvragen voor dashboard, portal of debug
 */
router.get("/:boxId", (req, res) => {
  const { boxId } = req.params;
  const status = STATUS[boxId];

  if (!status) {
    return res.status(404).json({
      ok: false,
      message: "Geen status bekend voor deze box"
    });
  }

  res.json({
    ok: true,
    boxId,
    status
  });
});

/**
 * GET /api/status
 * Overzicht van alle bekende boxen (admin / debug)
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    boxes: Object.values(STATUS)
  });
});

export default router;
