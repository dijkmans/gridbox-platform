// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";

const router = Router();

// ------------------------------------------------------
// COMMANDS (MOET BOVENAAN STAAN)
// ------------------------------------------------------

const pendingCommands = new Map();

/**
 * GET /api/boxes/:boxId/commands
 */
router.get("/:boxId/commands", (req, res) => {
  const { boxId } = req.params;

  if (!pendingCommands.has(boxId)) {
    pendingCommands.set(boxId, {
      id: "cmd-001",
      type: "open"
    });
  }

  const cmd = pendingCommands.get(boxId);
  if (!cmd) return res.json(null);

  return res.json(cmd);
});

/**
 * POST /api/boxes/:boxId/commands/:commandId/ack
 */
router.post("/:boxId/commands/:commandId/ack", (req, res) => {
  const { boxId, commandId } = req.params;
  const { result, shutterState } = req.body;

  console.log("COMMAND ACK:", {
    boxId,
    commandId,
    result,
    shutterState
  });

  pendingCommands.delete(boxId);

  res.json({ ok: true });
});

// ------------------------------------------------------
// BOX ROUTES
// ------------------------------------------------------

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
    const boxes = await boxesService.getAll();
    res.json(boxes);
  } catch (err) {
    console.error("Fout bij ophalen boxen:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    console.error("Fout bij ophalen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id/shares
 */
router.get("/:id/shares", async (req, res) => {
  try {
    const shares = await boxesService.getShares(req.params.id);
    res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/open
 */
router.post("/:id/open", async (req, res) => {
  try {
    const result = await boxesService.open(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij openen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 */
router.post("/:id/close", async (req, res) => {
  try {
    const result = await boxesService.close(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij sluiten box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
