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
 * We loggen dit in Firestore op:
 * boxes/{boxId}/status/current
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
 * Eventueel oude debug route behouden
 */
router.get("/:id", (req, res) => {
  res.json({ ok: true, deviceId: req.params.id });
});

export default router;
