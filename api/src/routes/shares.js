// api/src/routes/shares.js
//
// Bird versie (geen Twilio)
//
// Doel
// - Share opslaan in Firestore
// - SMS sturen via Bird via services/birdSmsService.js
// - Response velden behouden: smsSent en smsError
//
// Vereiste env vars (Cloud Run)
// - BIRD_ACCESS_KEY
//
// Als je Bird Channels API gebruikt (app.bird.com)
// - BIRD_SMS_WORKSPACE_ID
// - BIRD_SMS_CHANNEL_ID
//
// Als je legacy SMS gebruikt als fallback
// - BIRD_ORIGINATOR
//
// Optioneel
// - BIRD_TIMEOUT_MS
// - BIRD_DRY_RUN

import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";
import { sendSms } from "../services/birdSmsService.js";

const router = Router();
const db = getFirestore();

const SHARES_VERSION = "shares-v8-bird-2026-01-19";

/* =========================
   Helpers
   ========================= */

function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim().replace(/\s+/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) s = "+" + s;

  return s || null;
}

function isValidE164(number) {
  return /^\+[1-9]\d{7,14}$/.test(number || "");
}

function parseExpiresAtToIso(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // ISO of andere parsebare formats
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString();

  // dd/mm/yyyy of dd/mm/yyyy hh:mm
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = m[4] ? Number(m[4]) : 0;
    const min = m[5] ? Number(m[5]) : 0;

    const d = new Date(yyyy, mm - 1, dd, hh, min, 0);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  return null;
}

function maskPhone(p) {
  const s = String(p || "");
  if (s.length < 6) return s;
  return s.slice(0, 4) + "..." + s.slice(-2);
}

/* =========================
   Route
   ========================= */

router.post("/", async (req, res) => {
  let smsSent = false;
  let smsError = null;

  try {
    const phoneRaw = req.body?.phone ?? null;
    const boxNumberRaw = req.body?.boxNumber ?? null;
    const boxId = req.body?.boxId ?? null;

    const comment = req.body?.comment ?? "";
    const auth = !!(req.body?.auth ?? req.body?.authorized ?? false);
    const expiresIncoming = req.body?.expiresAt ?? req.body?.expires ?? null;

    const phone = normalizePhone(phoneRaw);
    const boxNumber = Number(boxNumberRaw);

    if (!phone || !isValidE164(phone)) {
      return res.status(400).json({
        ok: false,
        version: SHARES_VERSION,
        message: "Ongeldig telefoonnummer"
      });
    }
    if (!boxId) {
      return res.status(400).json({
        ok: false,
        version: SHARES_VERSION,
        message: "boxId is verplicht"
      });
    }
    if (!Number.isFinite(boxNumber)) {
      return res.status(400).json({
        ok: false,
        version: SHARES_VERSION,
        message: "boxNumber is verplicht"
      });
    }

    const expiresAt = parseExpiresAtToIso(expiresIncoming);

    const share = {
      phone,
      boxNumber,
      boxId: String(boxId),
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
      warnedAt: null,
      comment: comment || "",
      type: auth ? "authorized" : "temporary"
    };

    const docRef = await db.collection("shares").add(share);

    const smsText = buildShareSms({
      boxNumber,
      expiresAt: expiresAt || null
    });

    // Verstuur via centrale Bird service
    const smsRes = await sendSms({ to: phone, body: smsText });

    if (smsRes?.ok) {
      smsSent = true;
      console.log("✅ Bird SMS verstuurd", { to: maskPhone(phone), shareId: docRef.id, id: smsRes.id || null });
    } else {
      smsError = smsRes?.error || "Bird sms fout";
      console.error("⚠️ Bird verzendfout", { to: maskPhone(phone), shareId: docRef.id, smsError });
    }

    // Schrijf sms status terug naar share doc
    await db.collection("shares").doc(docRef.id).set(
      {
        smsSentAt: smsSent ? new Date().toISOString() : null,
        smsProvider: smsSent ? "bird" : null,
        smsError: smsSent ? null : smsError,
        smsMessageId: smsSent ? (smsRes?.id || null) : null
      },
      { merge: true }
    );

    return res.status(201).json({
      ok: true,
      version: SHARES_VERSION,
      shareId: docRef.id,
      sms: smsText,
      smsSent,
      smsError
    });
  } catch (err) {
    console.error("❌ share create error:", err);
    return res.status(500).json({
      ok: false,
      version: SHARES_VERSION,
      message: "Share kon niet worden aangemaakt",
      smsSent,
      smsError
    });
  }
});

export default router;
