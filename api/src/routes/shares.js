import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();
const db = getFirestore();

/**
 * POST /api/shares
 * Maakt een share aan en genereert een SMS-bericht
 */
router.post("/", async (req, res) => {
  try {
    const { phone, boxNumber, boxId } = req.body;

    if (!phone || boxNumber === undefined || !boxId) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber en boxId zijn verplicht"
      });
    }

    const share = {
      active: true,
      phone,
      boxNumber: Number(boxNumber),
      boxId,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection("shares").add(share);

    const smsText =
      `Gridbox ${boxNumber} is met u gedeeld. ` +
      `Antwoord op deze SMS met OPEN ${boxNumber} om de Gridbox te openen.`;

    console.log("📤 SHARE SMS (simulatie):", {
      to: phone,
      message: smsText
    });

    return res.status(201).json({
      ok: true,
      shareId: docRef.id,
      sms: smsText
    });

  } catch (err) {
    console.error("❌ share create error:", err);
    return res.status(500).json({
      ok: false,
      message: "Share kon niet worden aangemaakt"
    });
  }
});

export default router;
