import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";

const router = Router();
const db = getFirestore();

/**
 * POST /api/shares
 * Maakt een share aan met:
 * - waarschuwing 1 uur vooraf
 * - blokkering op eindmoment
 */
router.post("/", async (req, res) => {
  try {
    const { phone, boxNumber, boxId, validUntil } = req.body;

    // -----------------------------
    // 1. Validatie
    // -----------------------------

    if (!phone || boxNumber === undefined || !boxId || !validUntil) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber, boxId en validUntil zijn verplicht"
      });
    }

    const blockedAt = new Date(validUntil);
    if (isNaN(blockedAt.getTime())) {
      return res.status(400).json({
        ok: false,
        message: "validUntil is geen geldige datum"
      });
    }

    // -----------------------------
    // 2. Waarschuwingsmoment bepalen
    // -----------------------------

    const expiresAt = new Date(
      blockedAt.getTime() - 60 * 60 * 1000
    );

    // -----------------------------
    // 3. Share opslaan
    // -----------------------------

    const share = {
      active: true,
      phone,
      boxNumber: Number(boxNumber),
      boxId,

      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      blockedAt: blockedAt.toISOString(),

      warningSent: false
    };

    const docRef = await db
      .collection("shares")
      .add(share);

    // -----------------------------
    // 4. SMS-tekst (informatief)
    // -----------------------------

    const smsText = buildShareSms({
      boxNumber: share.boxNumber,
      expiresAt: share.expiresAt
    });

    console.log("📤 SHARE SMS (simulatie):", {
      to: phone,
      message: smsText
    });

    // -----------------------------
    // 5. Response
    // -----------------------------

    return res.status(201).json({
      ok: true,
      shareId: docRef.id,
      sms: smsText,
      expiresAt: share.expiresAt,
      blockedAt: share.blockedAt
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
