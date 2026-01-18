// api/src/routes/smsWebhook.js
//
// Bird first:
// - Inkomende sms komt via Bird als JSON
// - We antwoorden naar Bird met JSON (200 OK), maar sturen de echte reply naar de klant via Bird SMS
// - We laten From/Body (Twilio stijl) toe als fallback voor manuele tests (curl/postman)
//
// Vereiste env vars (Cloud Run)
// - BIRD_ACCESS_KEY
// - BIRD_ORIGINATOR
//
// Optioneel
// - BIRD_API_BASE (default https://rest.messagebird.com)
// - BIRD_TIMEOUT_MS (default 10000)
// - SMS_REPLY_ENABLED ("0" om geen reply sms te sturen, default aan)
// - LOG_SMS_PAYLOAD ("1" om payload volledig te loggen, let op privacy)

import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

const SMS_VERSION = "sms-webhook-v4-bird-2026-01-19";

router.use(urlencoded({ extended: false }));
router.use(json());

/* =========================
   Basis response helpers
   ========================= */

function apiOk(res, message, extra = {}) {
  return res.status(200).json({ ok: true, version: SMS_VERSION, message, ...extra });
}

function apiFail(res, message, extra = {}) {
  return res.status(200).json({ ok: false, version: SMS_VERSION, message, ...extra });
}

function maskPhone(p) {
  const s = String(p || "");
  if (s.length < 6) return s;
  return s.slice(0, 4) + "..." + s.slice(-2);
}

/* =========================
   Payload parsing
   ========================= */

function getIncomingFrom(req) {
  // Bird
  // sender.identifierValue is meestal het nummer
  return (
    req.body?.sender?.identifierValue ??
    req.body?.sender?.value ??
    req.body?.from ??
    // fallback (Twilio test)
    req.body?.From ??
    req.body?.sender ??
    null
  );
}

function getIncomingText(req) {
  // Bird
  const v =
    req.body?.body?.text?.text ??
    req.body?.body?.text ??
    // andere varianten
    req.body?.message ??
    req.body?.text ??
    // fallback (Twilio test)
    req.body?.Body ??
    "";

  if (typeof v === "string") return v;

  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}

/* =========================
   Normalisatie en parsing
   ========================= */

function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim();

  // whatsapp:+324... -> +324...
  if (s.toLowerCase().startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length);
  }

  // alles weg behalve cijfers en +
  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) s = "+" + s;

  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

function parseCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

  // Voorbeelden:
  // open 5, open5, openen 5
  // sluit 2, dicht10, toe 3
  // close 3
  const match = text.match(/\b(open|openen|close|sluit|dicht|toe)\b\s*[-:]?\s*(\d{1,3})\b/);
  if (!match) return { command: null, boxNr: null };

  let command = match[1];
  const boxNr = parseInt(match[2], 10);

  if (!Number.isFinite(boxNr)) return { command: null, boxNr: null };

  if (command === "openen") command = "open";
  if (command === "sluit" || command === "dicht" || command === "toe") command = "close";

  if (command !== "open" && command !== "close") return { command: null, boxNr: null };

  return { command, boxNr };
}

function usageText() {
  return "Gebruik: open 5 of sluit 5.";
}

/* =========================
   Share helpers
   ========================= */

function resolveBoxId(share) {
  return share?.boxId ?? share?.box ?? share?.portalId ?? share?.boxRef ?? null;
}

function toMillis(v) {
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function isShareBlockedOrExpired(share) {
  const now = Date.now();

  const blockedAtMs = toMillis(share?.blockedAt);
  if (blockedAtMs && now >= blockedAtMs) return true;

  const expiresAtMs = toMillis(share?.expiresAt);
  if (expiresAtMs && now >= expiresAtMs) return true;

  return false;
}

/* =========================
   Bird SMS sender (legacy MessageBird SMS API)
   ========================= */

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

function isReplyEnabled() {
  const v = String(process.env.SMS_REPLY_ENABLED ?? "").trim().toLowerCase();
  if (!v) return true;
  return !(v === "0" || v === "false" || v === "no");
}

async function birdSendSms(to, body) {
  const accessKey = getBirdAccessKey();
  const originator = getBirdOriginator();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!originator) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ORIGINATOR ontbreekt." };

  const url = `${getBirdApiBase()}/messages`;

  const params = new URLSearchParams();
  params.set("recipients", String(to));
  params.set("originator", String(originator));
  params.set("body", String(body));

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
      try {
        const j = rawText ? JSON.parse(rawText) : null;
        const e0 = Array.isArray(j?.errors) && j.errors.length ? j.errors[0] : null;
        const msg = e0?.description || e0?.message || rawText || resp.statusText;
        return { ok: false, error: `Bird error status=${resp.status} ${msg}` };
      } catch {
        return { ok: false, error: `Bird error status=${resp.status} ${rawText || resp.statusText}` };
      }
    }

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

async function replySmsIfEnabled(to, text) {
  if (!isReplyEnabled()) return;
  const r = await birdSendSms(to, text);
  if (!r.ok) {
    console.error("⚠️ Bird reply sms faalde", { to: maskPhone(to), error: r.error });
  }
}

/* =========================
   POST /api/sms
   ========================= */

router.post("/", async (req, res) => {
  if (process.env.LOG_SMS_PAYLOAD === "1") {
    console.log("📩 SMS payload:", JSON.stringify(req.body, null, 2));
  }

  const rawFrom = getIncomingFrom(req);
  const rawText = getIncomingText(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseCommand(rawText);

  console.log("➡️ SMS parsed", {
    from: maskPhone(from),
    command,
    boxNr
  });

  try {
    // 1) basis checks
    if (!from) {
      return apiFail(res, "Ongeldig nummer of afzender onbekend.");
    }

    if (!command || !boxNr) {
      await replySmsIfEnabled(from, usageText());
      return apiFail(res, usageText());
    }

    if (boxNr < 1 || boxNr > 999) {
      await replySmsIfEnabled(from, "Ongeldig boxnummer.");
      return apiFail(res, "Ongeldig boxnummer.");
    }

    // 2) toegang (share)
    let share;
    try {
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } catch (e) {
      console.error("❌ sharesService error:", e);
      await replySmsIfEnabled(from, "Interne fout bij toegangscontrole.");
      return apiFail(res, "Interne fout bij toegangscontrole.");
    }

    if (!share) {
      const msg = `U heeft geen toegang tot Gridbox ${boxNr}.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    if (isShareBlockedOrExpired(share)) {
      const msg = `Uw toegang tot Gridbox ${boxNr} is verlopen.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    // 3) boxId uit share
    const boxId = resolveBoxId(share);
    if (!boxId) {
      console.error("❌ Share zonder boxId", { shareId: share?.id ?? null });
      await replySmsIfEnabled(from, "Interne fout: box koppeling ontbreekt.");
      return apiFail(res, "Interne fout: box koppeling ontbreekt.");
    }

    // 4) actie uitvoeren
    let result;
    try {
      if (command === "open") {
        try {
          result = await boxesService.openBox(boxId, { source: "sms", phone: from });
        } catch {
          result = await boxesService.openBox(boxId, "sms", from);
        }
      } else {
        try {
          result = await boxesService.closeBox(boxId, { source: "sms", phone: from });
        } catch {
          result = await boxesService.closeBox(boxId, "sms", from);
        }
      }
    } catch (e) {
      console.error("❌ boxesService error:", e);
      await replySmsIfEnabled(from, "Interne fout bij uitvoeren box-actie.");
      return apiFail(res, "Interne fout bij uitvoeren box-actie.");
    }

    if (!result || result.success !== true) {
      const msg = `Gridbox ${boxNr} reageert momenteel niet.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    const actieText = command === "open" ? "geopend" : "gesloten";
    const msg = `Gridbox ${boxNr} wordt nu ${actieText}.`;

    await replySmsIfEnabled(from, msg);

    return apiOk(res, msg, { boxId, boxNr, command });
  } catch (err) {
    console.error("🔥 ONVERWACHTE CRASH:", err, err?.stack);
    return res.status(500).json({ ok: false, version: SMS_VERSION, message: "Onverwachte systeemfout." });
  }
});

export default router;
