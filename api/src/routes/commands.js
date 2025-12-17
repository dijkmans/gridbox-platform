// api/src/routes/commands.js

import { Router } from "express";
import * as commandsService from "../services/commandsService.js";

const router = Router();

/**
 * GET /api/commands/:boxId
 * Raspberry Pi vraagt of er een commando klaarstaat
 *
 * TESTVERSIE:
 * We forceren tijdelijk altijd één "open" command
 */
router.get("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    // ---- TEST COMMAND (tijdelijk) ----
    return res.json({
      id: "test-001",
      type: "open",
      payload: null
    });

    // ---- NORMALE LOGICA (later terug activeren) ----
    /*
    const commands = await commandsService.getPendingCommands(boxId);

    if (!commands || commands.length === 0) {
      return res.json(null);
    }

    const command = commands[0];

    return res.json({
      id: command.id,
      type: command.type,
      payload: command.payload || null
    });
    */

  } catch (err) {
    console.error("Fout in GET /api/commands/:boxId:", err);
    return res.status(500).json(null);
  }
});

/**
 * POST /api/commands/:boxId/ack
 * Raspberry Pi bevestigt ontvangst of uitvoering
 */
router.post("/:boxId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { commandId, result } = req.body;

    if (!commandId) {
      return res.status(400).json({
        ok: false,
        message: "commandId ontbreekt"
      });
    }

    // Voor test: gewoon loggen
    console.log("ACK ontvangen:", { boxId, commandId, result });

    // Later:
    // await commandsService.ackCommand(boxId, commandId, result || "ok");

    return res.json({
      ok: true
    });

  } catch (err) {
    console.error("Fout in POST /api/commands/:boxId/ack:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout"
    });
  }
});

export default router;
