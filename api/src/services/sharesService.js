import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/*
  We ondersteunen zowel:
  - Twilio: application/x-www-form-urlencoded (From, Body)
  - JSON providers: application/json (verschillende velden)
*/
router.use(urlencoded({ extended: false }));
router.use(json());

/* =========================
   Helpers
   ========================= */

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

/*
  Haal telefoonnummer uit meerdere mogelijke payloads.
  Twilio gebruikt meestal From.
*/
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

/*
  Haal berichttekst uit meerdere mogelijke payloads.
  Twilio gebruikt meestal Body.
*/
function getIncomingBody(req) {
  const v =
    req.body?.Body ??
    req.body?.body?.text?.text ??
    req.body?.body?.text ??
    req.body?.message ??
    req.body?.text ??
    "";

  // Als er ooit per ongeluk een object binnenkomt, maken we er een string van
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}

/*
  Normaliseer telefoonnummer naar E.164, zo goed mogelijk.
  - spaties, haakjes, streepjes eruit
  - "00" wordt "+"
  - "0" wordt "+32" (Belgische aanname)
  - "32..." zonder plus wordt "+32..."
  - "whatsapp:+..." wordt "+..."
*/
function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim();

  // whatsapp:+324... -> +324...
  if (s.toLowerCase().startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length);
  }

  // alles weg behalve + en cijfers
  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Belgische lokale nummers 0xxx -> +32xxx
  if (s.startsWith("0")) s = "+32" + s.slice(1);

  // Sommige providers sturen "32..." zonder plus
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) {
    s = "+" + s;
  }

  // basis sanity check
  if (!/^\+\d{9,15}$/.test(s)) return null;

  return s;
}

/*
  Parser voor commando's.
  Voorbeelden die werken:
  - "open 5"
  - "open5"
  - "sluit 2"
  - "dicht10"
  - "close 3"
*/
function parseSmsCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

  // command + optionele spatie of teken + nummer
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
  return "Gebruik: 'open 5' of 'sluit 5' om een Gridbox te bedienen.";
}

/* =========================
   POST /api/sms
   ========================= */

router.post("/", async (req, res) => {
  const rawFrom = getIncomingFrom(req);
  const rawBody = getIncomingBody(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseSmsCommand(rawBody);

  console.log(
    `📩 SMS webhook binnen: from="${rawFrom}" -> "${from}" body="${String(rawBody).slice(0, 200)}" cmd="${command}" box="${boxNr}"`
  );

  try {
    // 1) Basis validatie
    if (!from) {
      return sendTwilioResponse(res, "Systeemfout: afzender onbekend of ongeldig nummerformaat.");
    }

    if (!command || !boxNr) {
      return sendTwilioResponse(res, usageText());
    }

    // optioneel: simpele range check zodat "open 999" niet per ongeluk rare dingen doet
    if (boxNr < 1 || boxNr > 999) {
      return sendTwilioResponse(res, "Ongeldig boxnummer. Gebruik een nummer tussen 1 en 999.");
    }

    // 2) Toegangscontrole via shares
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    if (!share) {
      console.warn(`⚠️ Toegang geweigerd: ${from} naar boxNr=${boxNr}`);
      return sendTwilioResponse(res, `U heeft geen actieve toegang tot Gridbox ${boxNr}.`);
    }

    if (!share.boxId) {
      console.error(`❌ Share gevonden maar boxId ontbreekt. shareId=${share.id ?? "onbekend"} boxNr=${boxNr}`);
      return sendTwilioResponse(res, "Systeemfout: toegang bestaat, maar box koppeling ontbreekt.");
    }

    // 3) Actie uitvoeren
    let result;
    if (command === "open") {
      result = await boxesService.openBox(share.boxId, "sms", from);
    } else {
      result = await boxesService.closeBox(share.boxId, "sms", from);
    }

    // 4) Bevestiging
    if (result?.success) {
      const actieText = command === "open" ? "geopend" : "gesloten";
      return sendTwilioResponse(res, `Gridbox ${boxNr} wordt nu ${actieText}.`);
    }

    console.warn(`⚠️ Box actie faalde of box offline. boxId=${share.boxId} cmd=${command} from=${from}`);
    return sendTwilioResponse(res, `Gridbox ${boxNr} is momenteel niet bereikbaar. Probeer later opnieuw.`);
  } catch (err) {
    console.error("❌ Kritieke fout in SMS webhook:", err);
    return sendTwilioResponse(res, "Er is een technische fout opgetreden in het Gridbox platform.");
  }
});

export default router;
