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
 * Geeft huidig command terug of null
 */
router.get("/:boxId/commands", (req, res) => {
  const { boxId } = req.params;

  if (!pendingCommands.has(boxId)) {
    return res.json(null);
  }

  const cmd = pendingCommands.get(boxId);
  return res.json(cmd);
});

/**
 * POST /api/boxes/:boxId/commands/:commandId/ack
 * Verwijdert command na uitvoering
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
 * Maakt een OPEN command aan
 */
router.post("/:id/open", async (req, res) => {
  try {
    pendingCommands.set(req.params.id, {
      id: "cmd-001",
      type: "open"
    });

    const result = await boxesService.open(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij openen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 * Maakt een CLOSE command aan
 */
router.post("/:id/close", async (req, res) => {
  try {
    pendingCommands.set(req.params.id, {
      id: "cmd-002",
      type: "close"
    });

    const result = await boxesService.close(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij sluiten box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
