import { Router } from "express";
import { sendExpiryWarnings } from "../services/shareWarningService.js";

const router = Router();

/**
 * POST /api/internal/send-expiry-warnings
 * Handmatige trigger voor waarschuwingen
 */
router.post("/send-expiry-warnings", async (req, res) => {
  try {
    const result = await sendExpiryWarnings();

    return res.json({
      ok: true,
      result
    });
  } catch (err) {
    console.error("❌ expiry warning job error:", err);

    return res.status(500).json({
      ok: false,
      message: "Waarschuwingsjob mislukt"
    });
  }
});

export default router;
