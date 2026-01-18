// api/src/routes/smsWebhook.js
//
// Bird first:
// - Inkomende sms komt via Bird als JSON
// - We antwoorden met JSON (Bird heeft geen TwiML nodig)
// - We laten Twilio velden (From, Body) toe als fallback voor manuele tests
//
// Verwacht commando: "open 5" of "sluit 5"
// Flow:
// - parse nummer + tekst
// - check share (toegang) op phone + boxNumber
// - check expired of blocked
// - box open of close via boxesService
// - JSON antwoord

import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

router.use(urlencoded({ extended: false }));
router.use(json());

const SMS_VERSION = "sms-webhook-v3-bird-2026-01-18";

/* =========================
   Response helpers
   ========================= */

function ok(res, message, extra = {}) {
  return res.status(200).json({ ok: true, version: SMS_VERSION, message, ...extra });
}

function fail(res, message, extra = {}) {
  return res.status(200).json({ ok: false, version: SMS_VERSION, message, ...extra });
}

/* =========================
   Payload parsing
   ========================= */

function getIncomingFrom(req) {
  // Bird komt meestal in sender.identifierValue
  // Twilio test: From
  return (
    req.body?.sender?.identifierValue ??
    req.body?.sender?.value ??
    req.body?.from ??
    req.body?.From ??
    req.body?.sender ??
    null
  );
}

function getIncomingBody(req) {
  // Bird komt meestal in body.text.text
  // Twilio test: Body
  const v =
    req.body?.body?.text?.text ??
    req.body?.body?.text ??
    req.body?.message ??
    req.body?.text ??
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
   Normalisatie
   ========================= */

function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim();

  // whatsapp:+324... -> +324...
  if (s.toLowerCase().startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length);
  }

  // Alles weg behalve cijfers en + teken
  s = s.replace(/[^\d+]/g, "");

  // 00 -> +
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Belgische lokale nummers 0xxx -> +32xxx
  if (s.startsWith("0")) s = "+32" + s.slice(1);

  // Providers sturen soms 32... zonder plus
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) s = "+" + s;

  // E.164 check
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;

  return s;
}

/* =========================
   Command parsing
   ========================= */

function parseSmsCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

  // Voorbeelden:
  // open 5
  // open5
  // sluit 2
  // dicht10
  // close 3
  const match = text.match(/\b(open|openen|close|sluit|dicht|toe)\b\s*[-:]?\s*(\d{1,3})\b/);
  if (!match) return { command: null, boxNr: null };

  let cmd = match[1];
  const boxNr = parseInt(match[2], 10);

  if (!Number.isFinite(boxNr)) return { command: null, boxNr: null };

  if (cmd === "openen") cmd = "open";
  if (cmd === "sluit" || cmd === "dicht" || cmd === "toe") cmd = "close";

  if (cmd !== "open" && cmd !== "close") return { command: null, boxNr: null };

  return { command: cmd, boxNr };
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

function isShareExpiredOrBlocked(share) {
  const now = Date.now();

  const blockedAtMs = toMillis(share?.blockedAt);
  if (blockedAtMs && now >= blockedAtMs) return true;

  const expiresAtMs = toMillis(share?.expiresAt);
  if (expiresAtMs && now >= expiresAtMs) return true;

  return false;
}

/* =========================
   Route
   ========================= */

router.post("/", async (req, res) => {
  const rawFrom = getIncomingFrom(req);
  const rawBody = getIncomingBody(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseSmsCommand(rawBody);

  console.log("📩 SMS webhook", {
    version: SMS_VERSION,
    rawFrom,
    from,
    rawBody: String(rawBody).slice(0, 200),
    command,
    boxNr
  });

  try {
    // 1) basis checks
    if (!from) return fail(res, "Afzender onbekend of ongeldig nummerformaat.");
    if (!command || !boxNr) return fail(res, usageText());

    // 2) box range check
    if (boxNr < 1 || boxNr > 999) return fail(res, "Ongeldig boxnummer.");

    // 3) share lookup
    let share;
    try {
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } catch (e) {
      console.error("❌ sharesService error:", e);
      return fail(res, "Interne fout bij toegangscontrole.");
    }

    if (!share) {
      console.warn("⚠️ Toegang geweigerd", { from, boxNr });
      return fail(res, `U heeft geen toegang tot Gridbox ${boxNr}.`);
    }

    if (isShareExpiredOrBlocked(share)) {
      return fail(res, `Uw toegang tot Gridbox ${boxNr} is verlopen.`);
    }

    // 4) boxId uit share halen
    const boxId = resolveBoxId(share);
    if (!boxId) {
      console.error("❌ Share heeft geen boxId", { shareId: share?.id, share });
      return fail(res, "Interne fout: box koppeling ontbreekt.");
    }

    // 5) open of close uitvoeren
    let result;
    try {
      if (command === "open") {
        // ondersteund 2 signatures
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
      return fail(res, "Interne fout bij uitvoeren box-actie.");
    }

    if (!result || result.success !== true) {
      return fail(res, `Gridbox ${boxNr} reageert momenteel niet.`);
    }

    const actieText = command === "open" ? "geopend" : "gesloten";
    return ok(res, `Gridbox ${boxNr} wordt nu ${actieText}.`, { boxId });

  } catch (err) {
    console.error("🔥 ONVERWACHTE CRASH:", err, err?.stack);
    return res.status(500).json({
      ok: false,
      version: SMS_VERSION,
      message: "Onverwachte systeemfout."
    });
  }
});

export default router;
