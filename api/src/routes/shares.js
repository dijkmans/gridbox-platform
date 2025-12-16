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
    const { phone, boxNumber, boxId } = req.body;

    // -----------------------------
    // 1. Validatie
    // -----------------------------

    if (!phone || boxNumber === undefined || !boxId) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber en boxId zijn verplicht"
      });
    }

    // -----------------------------
    // 2. Share opslaan
    // -----------------------------

    const share = {
      active: true,
      phone,
      boxNumber: Number(boxNumber),
      boxId,
      createdAt: new Date().toISOString()
    };

    const docRef = await db
      .collection("shares")
      .add(share);

    // -----------------------------
    // 3. SMS-tekst genereren
    // -----------------------------

    const smsText = buildShareSms({
      boxNumber: share.boxNumber
    });

    // Voor nu: simulatie via log
    console.log("📤 SHARE SMS (simulatie):", {
      to: phone,
      message: smsText
    });

    // -----------------------------
    // 4. Response
    // -----------------------------

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
