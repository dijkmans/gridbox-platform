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
    const {
      phone,
      boxNumber,
      boxId,
      expiresAt
    } = req.body;

    if (
      !phone ||
      boxNumber === undefined ||
      !boxId ||
      !expiresAt
    ) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber, boxId en expiresAt zijn verplicht"
      });
    }

    const share = {
      phone,
      boxNumber: Number(boxNumber),
      boxId,

      active: true,

      createdAt: new Date().toISOString(),
      expiresAt,

      warningSent: false
    };

    const docRef = await db.collection("shares").add(share);

    const smsText =
      `Gridbox ${boxNumber} is met u gedeeld. ` +
      `U kan deze Gridbox gebruiken tot ${new Date(expiresAt).toLocaleString("nl-BE")}. ` +
      `Antwoord met OPEN ${boxNumber} om te openen.`;

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
