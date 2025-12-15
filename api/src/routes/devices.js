import { Router } from "express";
import * as deviceService from "../services/devicesService.js";

const router = Router();

/**
 * Simpele healthcheck
 */
router.get("/", (req, res) => {
  res.json({ ok: true, message: "Devices endpoint werkt" });
});

/**
 * GET /api/devices/:boxId/config
 * Raspberry Pi haalt zijn volledige configuratie op
 */
router.get("/:boxId/config", async (req, res) => {
  try {
    const boxId = req.params.boxId;

    const config = await deviceService.getConfig(boxId);

    if (!config) {
      return res.status(404).json({
        ok: false,
        message: "Geen configuratie gevonden voor deze box",
        boxId
      });
    }

    return res.json({
      ok: true,
      config
    });

  } catch (err) {
    console.error("Fout in GET /devices/:boxId/config:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij ophalen configuratie"
    });
  }
});

/**
 * POST /api/devices/:boxId/status
 * Raspberry Pi stuurt status updates door
 * Wordt opgeslagen in:
 * boxes/{boxId}
 */
router.post("/:boxId/status", async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const status = req.body;

    if (!status || typeof status !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Ongeldige status payload"
      });
    }

    await deviceService.updateStatus(boxId, status);

    return res.json({
      ok: true,
      message: "Status ontvangen en opgeslagen",
      boxId
    });

  } catch (err) {
    console.error("Fout in POST /devices/:boxId/status:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij opslaan status"
    });
  }
});

/**
 * POST /api/devices/:boxId/events
 * Raspberry Pi stuurt events (boot, error, log, ...)
 * Wordt opgeslagen in:
 * boxes/{boxId}/events
 */
router.post("/:boxId/events", async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const body = req.body || {};

    const { type, payload = {}, timestamp = null, source = "device" } = body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        message: "Event type ontbreekt"
      });
    }

    await deviceService.addEvent(boxId, {
      type,
      payload,
      timestamp,
      source
    });

    return res.json({
      ok: true,
      message: "Event ontvangen en opgeslagen",
      boxId
    });

  } catch (err) {
    console.error("Fout in POST /devices/:boxId/events:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij opslaan event"
    });
  }
});

/**
 * POST /api/devices/:boxId/commands
 * Maakt een nieuw command aan
 * Path:
 * boxes/{boxId}/commands
 */
router.post("/:boxId/commands", async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        message: "Command type ontbreekt"
      });
    }

    const command = {
      type,
      status: "pending",
      createdAt: new Date()
    };

    await deviceService.addCommand(boxId, command);

    return res.json({
      ok: true,
      message: "Command aangemaakt",
      command
    });

  } catch (err) {
    console.error("Fout in POST /devices/:boxId/commands:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij aanmaken command"
    });
  }
});

/**
 * GET /api/devices/:boxId/commands/pending
 * Geeft alle pending commands terug
 */
router.get("/:boxId/commands/pending", async (req, res) => {
  try {
    const boxId = req.params.boxId;

    const commands = await deviceService.getPendingCommands(boxId);

    return res.json({
      ok: true,
      commands
    });

  } catch (err) {
    console.error("Fout in GET /devices/:boxId/commands/pending:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij ophalen commands"
    });
  }
});

/**
 * POST /api/devices/:boxId/commands/:commandId/done
 * Raspberry Pi bevestigt dat een command uitgevoerd is
 */
router.post("/:boxId/commands/:commandId/done", async (req, res) => {
  try {
    const boxId = req.params.boxId;
    const commandId = req.params.commandId;
    const body = req.body || {};

    const { result = "ok", payload = null, error = null } = body;

    await deviceService.markCommandDone(boxId, commandId, {
      result,
      payload,
      error
    });

    return res.json({
      ok: true,
      message: "Command gemarkeerd als done",
      boxId,
      commandId
    });

  } catch (err) {
    console.error("Fout in POST /devices/:boxId/commands/:commandId/done:", err);
    return res.status(500).json({
      ok: false,
      message: "Interne serverfout bij afronden command"
    });
  }
});

/**
 * Eventueel oude debug route behouden
 */
router.get("/:id", (req, res) => {
  res.json({ ok: true, deviceId: req.params.id });
});

export default router;
