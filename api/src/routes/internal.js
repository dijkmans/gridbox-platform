import { Router } from "express";
import { sendExpiryWarnings } from "../services/shareExpiryService.js";

const router = Router();

router.post("/send-expiry-warnings", async (req, res) => {
  try {
    const result = await sendExpiryWarnings();
    res.json({ ok: true, result });
  } catch (err) {
    console.error("❌ expiry warning error:", err);
    res.status(500).json({
      ok: false,
      message: "Expiry warnings mislukt"
    });
  }
});

export default router;
