import { Router } from "express";

const router = Router();

// In-memory status (tijdelijk, voor simulator & Pi)
const STATUS = {};

/**
 * POST /api/status/:boxId
 * Ontvang status / heartbeat van Pi of simulator
 */
router.post("/:boxId", (req, res) => {
  const { boxId } = req.params;

  STATUS[boxId] = {
    ...req.body,
    lastSeen: new Date()
  };

  res.json({
    ok: true,
    boxId,
    status: STATUS[boxId]
  });
});

/**
 * GET /api/status/:boxId
 * Status opvragen (dashboard / debug)
 */
router.get("/:boxId", (req, res) => {
  const { boxId } = req.params;

  const status = STATUS[boxId];
  if (!status) {
    return res.status(404).json({
      ok: false,
      error: "Geen status gekend"
    });
  }

  res.json({
    ok: true,
    boxId,
    status
  });
});

export default router;
