import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";
import twilio from "twilio"; // Importeer Twilio

const router = Router();
const db = getFirestore();

// Initialiseer Twilio met je omgevingsvariabelen
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/shares
 * Maakt een share aan in Firestore EN verstuurt de SMS via Twilio
 */
router.post("/", async (req, res) => {
  try {
    const {
      phone,
      boxNumber,
      boxId,
      expiresAt
    } = req.body;

    // 1. Validatie
    if (!phone || boxNumber === undefined || !boxId) {
      return res.status(400).json({
        ok: false,
        message: "phone, boxNumber en boxId zijn verplicht"
      });
    }

    // 2. Data voorbereiden
    const share = {
      phone,
      boxNumber: Number(boxNumber),
      boxId,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
      warnedAt: null
    };

    // 3. Opslaan in Firestore
    const docRef = await db.collection("shares").add(share);

    // 4. SMS-tekst genereren via jouw bestaande utility
    const smsText = buildShareSms({
      boxNumber: Number(boxNumber),
      expiresAt: expiresAt || null
    });

    // 5. DE SMS EFFECTIEF VERSTUREN VIA TWILIO
    let smsSent = false;
    try {
      await client.messages.create({
        body: smsText,
        from: process.env.TWILIO_PHONE_NUMBER || "+3197010222962",
        to: phone
      });
      smsSent = true;
      console.log(`✅ SMS succesvol verstuurd naar ${phone}`);
    } catch (twilioErr) {
      console.error("⚠️ Twilio verzendfout:", twilioErr.message);
      // We gaan door, want de share staat wel in de database
    }

    return res.status(201).json({
      ok: true,
      shareId: docRef.id,
      sms: smsText,
      smsSent: smsSent
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
