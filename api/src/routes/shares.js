// api/src/routes/shares.js
//
// Bird versie (geen Twilio meer)
//
// Doel
// - Share opslaan in Firestore
// - Sms sturen via Bird (MessageBird legacy SMS API: https://rest.messagebird.com/messages)
// - Zelfde response velden behouden: smsSent en smsError
//
// Vereiste env vars (Cloud Run)
// - BIRD_ACCESS_KEY
// - BIRD_ORIGINATOR   (bv. +32480214031 of een toegelaten sender)
//
// Optioneel
// - BIRD_API_BASE     (default https://rest.messagebird.com)
// - BIRD_TIMEOUT_MS   (default 10000)
// - BIRD_DRY_RUN      ("1" of "true" om niet te versturen, wel te loggen)

import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { buildShareSms } from "../utils/shareMessages.js";

const router = Router();
const db = getFirestore();

const SHARES_VERSION = "shares-v7-bird-2026-01-19";

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

    // Let op: dit gebruikt de server timezone. Als je strikt Europe/Brussels wil,
    // stuur best ISO binnen vanuit je portal.
    const d = new Date(yyyy, mm - 1, dd, hh, min, 0);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  return null;
}

function getBirdAccessKey() {
  return process.env.BIRD_ACCESS_KEY || process.env.MESSAGEBIRD_ACCESS_KEY || null;
}

function getBirdOriginator() {
  return (
    process.env.BIRD_ORIGINATOR ||
    process.env.MESSAGEBIRD_ORIGINATOR ||
    process.env.BIRD_FROM ||
    process.env.MESSAGEBIRD_FROM ||
    null
  );
}

function getBirdApiBase() {
  const base = process.env.BIRD_API_BASE || "https://rest.messagebird.com";
  return String(base).replace(/\/+$/, "");
}

function getBirdTimeoutMs() {
  const n = Number(process.env.BIRD_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

function isBirdDryRun() {
  const v = String(process.env.BIRD_DRY_RUN || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function birdSendSms({ to, body }) {
  const accessKey = getBirdAccessKey();
  const originator = getBirdOriginator();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!originator) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ORIGINATOR ontbreekt." };

  const url = `${getBirdApiBase()}/messages`;

  // MessageBird legacy API verwacht form-url-encoded
  const params = new URLSearchParams();
  params.set("recipients", String(to));
  params.set("originator", String(originator));
  params.set("body", String(body));

  if (isBirdDryRun()) {
    console.log("🟡 Bird DRY RUN sms", { to, originator, body: String(body).slice(0, 160) });
    return { ok: true, id: null, raw: { dryRun: true } };
  }

  const timeoutMs = getBirdTimeoutMs();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${accessKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString(),
      signal: ac.signal
    });

    const rawText = await resp.text().catch(() => "");
    clearTimeout(timer);

    if (!resp.ok) {
      // Probeer MessageBird error formaat te lezen
      try {
        const j = rawText ? JSON.parse(rawText) : null;
        const e0 = Array.isArray(j?.errors) && j.errors.length ? j.errors[0] : null;
        const msg = e0?.description || e0?.message || rawText || resp.statusText;
        return { ok: false, error: `Bird error status=${resp.status} ${msg}` };
      } catch {
        return { ok: false, error: `Bird error status=${resp.status} ${rawText || resp.statusText}` };
      }
    }

    // Succes response is JSON
    try {
      const data = rawText ? JSON.parse(rawText) : null;
      return { ok: true, id: data?.id ?? null, raw: data };
    } catch {
      return { ok: true, id: null, raw: rawText };
    }
  } catch (e) {
    clearTimeout(timer);
    const msg = e?.name === "AbortError" ? `Bird timeout na ${timeoutMs}ms` : (e?.message || String(e));
    return { ok: false, error: `Bird fetch error: ${msg}` };
  }
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

    const sendRes = await birdSendSms({ to: phone, body: smsText });

    if (sendRes.ok) {
      smsSent = true;
      console.log("✅ Bird SMS verstuurd", { to: phone, id: sendRes.id, shareId: docRef.id });
    } else {
      smsError = sendRes.error || "Bird sms fout";
      console.error("⚠️ Bird verzendfout", { to: phone, shareId: docRef.id, smsError });
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
