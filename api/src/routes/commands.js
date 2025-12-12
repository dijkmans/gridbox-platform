import { Router } from "express";
import * as commandsService from "../services/commandsService.js";

const router = Router();

/**
 * GET /api/commands/:boxId
 * Raspberry Pi haalt openstaande commando’s op
 */
router.get("/:boxId", async (req, res) => {
  try {
    const boxId = req.params.boxId;

    const commands = await commandsService.getPendingCommands(boxId);

    return res.json({
      ok: true,
      boxId,
      commands
    });

  } catch (err) {
    console.error("Fout in GET /commands/:boxId:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij ophalen commands"
    });
  }
});

/**
 * POST /api/commands/:boxId/ack
 * Raspberry Pi bevestigt uitgevoerd commando
 */
router.post("/:boxId/ack", async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const { commandId, result } = req.body;

    if (!commandId) {
      return res.status(400).json({
        ok: false,
        message: "commandId ontbreekt"
      });
    }

    await commandsService.ackCommand(boxId, commandId, result);

    return res.json({
      ok: true,
      message: "Commando bevestigd",
      boxId,
      commandId
    });

  } catch (err) {
    console.error("Fout in POST /commands/:boxId/ack:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij bevestigen commando"
    });
  }
});

export default router;
