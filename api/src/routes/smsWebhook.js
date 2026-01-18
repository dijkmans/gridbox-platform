// api/src/routes/smsWebhook.js

import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/*
  We ondersteunen 2 types inkomende requests:

  1) Twilio inbound SMS
     Content-Type: application/x-www-form-urlencoded
     Velden: From, Body
     Verwacht meestal TwiML terug als je ook wil antwoorden via sms.

  2) Andere providers (zoals Bird of eigen gateway)
     Content-Type: application/json
     Velden kunnen verschillen, daarom doen we meerdere fallbacks.
*/

router.use(urlencoded({ extended: false }));
router.use(json());

/* =========================================================
   Helpers
   ========================================================= */

function safeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sendTwilioResponse(res, message) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safeXml(message)}</Message>
</Response>`;
  return res.status(200).type("text/xml").send(twiml);
}

function sendJsonResponse(res, ok, message, extra = {}) {
  return res.status(200).json({ ok, message, ...extra });
}

function isProbablyTwilio(req) {
  // Twilio inbound is vaak urlencoded en bevat From/Body
  return (
    typeof req.body?.From === "string" ||
    typeof req.body?.Body === "string"
  );
}

function getIncomingFrom(req) {
  return (
    req.body?.From ??
    req.body?.from ??
    req.body?.sender?.identifierValue ??
    req.body?.sender?.value ??
    req.body?.sender ??
    null
  );
}

function getIncomingText(req) {
  const v =
    req.body?.Body ??
    req.body?.body?.text?.text ??
    req.body?.body?.text ??
    req.body?.message ??
    req.body?.text ??
    "";

  if (typeof v === "string") return v;

  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}

function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim();

  // whatsapp:+324... -> +324...
  if (s.toLowerCase().startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length);
  }

  // spaties, haakjes, streepjes enz weg, maar + behouden
  s = s.replace(/[^\d+]/g, "");

  // 00xx -> +xx
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // 0xxx -> +32xxx (Belgische aanname)
  if (s.startsWith("0")) s = "+32" + s.slice(1);

  // 32... zonder plus -> +32...
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) {
    s = "+" + s;
  }

  return s || null;
}

function isValidE164(number) {
  return /^\+[1-9]\d{7,14}$/.test(number || "");
}

function parseCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

  // Voorbeelden:
  // open 5
  // open5
  // sluit 2
  // dicht10
  // close 3
  const match = text.match(/\b(open|openen|close|sluit|dicht|toe)\b\s*[-:]?\s*(\d{1,3})\b/);
  if (!match) return { command: null, boxNr: null };

  let command = match[1];
  const boxNr = parseInt(match[2], 10);

  if (!Number.isFinite(boxNr)) return { command: null, boxNr: null };

  if (command === "openen") command = "open";
  if (command === "sluit" || command === "dicht" || command === "toe") command = "close";

  if (command !== "open" && command !== "close") {
    return { command: null, boxNr: null };
  }

  return { command, boxNr };
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

function resolveBoxId(share) {
  return share?.boxId ?? share?.box ?? share?.portalId ?? share?.boxRef ?? null;
}

function reply(res, req, ok, message, extra = {}) {
  if (isProbablyTwilio(req)) {
    // Twilio: TwiML teruggeven zodat je meteen een reply sms kan sturen
    return sendTwilioResponse(res, message);
  }
  // Andere providers: JSON
  return sendJsonResponse(res, ok, message, extra);
}

/* =========================================================
   POST /api/sms
   ========================================================= */

router.post("/", async (req, res) => {
  // Zet dit aan als je echt alles wil loggen.
  // In productie is dit vaak te veel en bevat het persoonsgegevens.
  if (process.env.LOG_SMS_PAYLOAD === "1") {
    console.log("📩 SMS webhook payload:", JSON.stringify(req.body, null, 2));
  }

  const rawFrom = getIncomingFrom(req);
  const rawText = getIncomingText(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseCommand(rawText);

  console.log("➡️ SMS parsed:", {
    from,
    command,
    boxNr,
    provider: isProbablyTwilio(req) ? "twilio" : "json"
  });

  try {
    // 1) basis validatie
    if (!from || !isValidE164(from)) {
      return reply(res, req, false, "Ongeldig nummer of afzender onbekend.");
    }

    if (!command || !boxNr) {
      return reply(res, req, false, "Gebruik: open 5 of sluit 5.");
    }

    if (boxNr < 1 || boxNr > 999) {
      return reply(res, req, false, "Ongeldig boxnummer.");
    }

    // 2) share lookup (toegang controleren)
    let share;
    try {
      // boxNr is nu een getal
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } catch (e) {
      console.error("❌ sharesService error:", e);
      return reply(res, req, false, "Interne fout bij toegangscontrole.");
    }

    if (!share) {
      console.warn(`⚠️ Toegang geweigerd: ${from} naar box ${boxNr}`);
      return reply(res, req, false, `U heeft geen toegang tot Gridbox ${boxNr}.`);
    }

    if (isShareBlockedOrExpired(share)) {
      return reply(res, req, false, `Uw toegang tot Gridbox ${boxNr} is verlopen.`);
    }

    // 3) boxId bepalen
    const boxId = resolveBoxId(share);
    if (!boxId) {
      console.error("❌ Geen boxId in share:", share);
      return reply(res, req, false, "Interne fout: box niet gevonden.");
    }

    // 4) open of close uitvoeren
    let result;
    try {
      if (command === "open") {
        // 2 mogelijke signatures bestaan vaak in codebases:
        // openBox(boxId, source, phone) of openBox(boxId, {source, phone})
        // We proberen eerst de objectvorm, en vallen terug als dat faalt.
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
      return reply(res, req, false, "Interne fout bij uitvoeren box-actie.");
    }

    if (!result || result.success !== true) {
      return reply(res, req, false, `Gridbox ${boxNr} reageert momenteel niet.`);
    }

    const actieText = command === "open" ? "geopend" : "gesloten";
    return reply(res, req, true, `Gridbox ${boxNr} wordt nu ${actieText}.`);
  } catch (err) {
    console.error("🔥 ONVERWACHTE CRASH:", err, err?.stack);
    return res.status(500).json({ ok: false, message: "Onverwachte systeemfout." });
  }
});

export default router;
