// api/src/routes/status.js
import { Router } from "express";

const router = Router();

// tijdelijke in-memory opslag
const STATUS = {};

// POST /api/status/:boxId
router.post("/:boxId", (req, res) => {
  const { boxId } = req.params;
  const {
    state = null,
    source = null,
    uptime = null,
    temp = null,
    type = "heartbeat"
  } = req.body || {};

  STATUS[boxId] = {
    online: true,
    state,
    source,
    uptime,
    temp,
    type,
    lastSeen: new Date().toISOString()
  };

  res.json({
    ok: true,
    boxId,
    status: STATUS[boxId]
  });
});

// GET /api/status/:boxId
router.get("/:boxId", (req, res) => {
  const { boxId } = req.params;
  const status = STATUS[boxId];

  if (!status) {
    return res.status(404).json({
      ok: false,
      error: "Geen status bekend"
    });
  }

  res.json({
    ok: true,
    boxId,
    status
  });
});

export default router;
