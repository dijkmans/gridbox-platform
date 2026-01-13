import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";
import twilio from "twilio";

const router = Router();
const db = getFirestore();

const SHARES_VERSION = "shares-v5-2026-01-13";

function normalizePhone(number) {
  if (!number) return null;
  let s = String(number).trim().replace(/\s+/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  return s || null;
}

function isValidE164(number) {
  return /^\+[1-9]\d{7,14}$/.test(number || "");
}

function parseExpiresAtToIso(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString();

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

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function twilioErrToText(e) {
  const code = e?.code ?? null;
  const status = e?.status ?? null;
  const msg = e?.message ? String(e.message) : String(e);
  return `Twilio error code=${code} status=${status} message=${msg}`;
}

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
      return res.status(400).json({ ok: false, version: SHARES_VERSION, message: "Ongeldig telefoonnummer" });
    }
    if (!boxId) {
      return res.status(400).json({ ok: false, version: SHARES_VERSION, message: "boxId is verplicht" });
    }
    if (!Number.isFinite(boxNumber)) {
      return res.status(400).json({ ok: false, version: SHARES_VERSION, message: "boxNumber is verplicht" });
    }

    const expiresAt = parseExpiresAtToIso(expiresIncoming);

    const share = {
      phone,
      boxNumber,
      boxId,
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

    const from = process.env.TWILIO_PHONE_NUMBER || "";
    const client = getTwilioClient();

    if (!client) {
      smsError = "Twilio niet geconfigureerd: TWILIO_ACCOUNT_SID of TWILIO_AUTH_TOKEN ontbreekt.";
      console.error("⚠️", smsError);
    } else if (!from) {
      smsError = "Twilio niet geconfigureerd: TWILIO_PHONE_NUMBER ontbreekt.";
      console.error("⚠️", smsError);
    } else {
      try {
        const msg = await client.messages.create({
          body: smsText,
          from,
          to: phone
        });
        smsSent = true;
        console.log("✅ SMS verstuurd", { to: phone, sid: msg.sid, shareId: docRef.id });
      } catch (e) {
        smsError = twilioErrToText(e);
        console.error("⚠️ Twilio verzendfout:", smsError);
      }
    }

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
