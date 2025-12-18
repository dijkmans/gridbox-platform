import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";

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
      !boxId
    ) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber en boxId zijn verplicht"
      });
    }

    const share = {
      phone,
      boxNumber: Number(boxNumber),
      boxId,

      active: true,

      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,

      warnedAt: null
    };

    const docRef = await db
      .collection("shares")
      .add(share);

    // 👉 ENIGE BRON VAN WAARHEID VOOR SHARE-SMS
    const smsText = buildShareSms({
      boxNumber: Number(boxNumber),
      expiresAt: expiresAt || null
    });

    // In productie wordt dit via smsAdapter verstuurd
    console.log("📤 SHARE SMS:", {
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
