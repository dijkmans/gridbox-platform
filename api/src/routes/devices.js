import { Router } from "express";
import * as deviceService from "../services/devicesService.js";

const router = Router();

/**
 * Eenvoudige healthcheck: toont dat devices API werkt
 */
router.get("/", (req, res) => {
  res.json({ ok: true, message: "Devices endpoint werkt" });
});

/**
 * GET /api/devices/:boxId/config
 * Haal configuratie op voor Raspberry Pi
 */
router.get("/:boxId/config", async (req, res) => {
  try {
    const boxId = req.params.boxId;

    const config = await deviceService.getConfig(boxId);

    if (!config) {
      return res.status(404).json({
        ok: false,
        error: "Geen configuratie gevonden voor deze box",
        boxId
      });
    }

    return res.json({
      ok: true,
      ...config
    });

  } catch (err) {
    console.error("Fout in GET /devices/:boxId/config:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout"
    });
  }
});

/**
 * Optioneel: oude route laten bestaan voor debugging
 */
router.get("/:id", (req, res) => {
  res.json({ ok: true, deviceId: req.params.id });
});

export default router;
