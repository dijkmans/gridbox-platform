import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

// Middleware om inkomende data van Twilio (urlencoded) en JSON te verwerken
router.use(urlencoded({ extended: false }));
router.use(json());

/**
 * Normaliseert het telefoonnummer naar internationaal E.164 formaat
 */
function normalizePhone(number) {
  if (!number) return null;
  let s = String(number).trim().replace(/\s+/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  return s || null;
}

/**
 * Helper om XML-respons naar Twilio te sturen
 */
function sendTwilioResponse(res, message) {
  const safeMessage = String(message || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${safeMessage}</Message>
</Response>`;

  return res.status(200).type("text/xml").send(twiml);
}

/**
 * Parser voor commando's zoals "open 1", "open1", "sluit 2"
 */
function parseSmsBody(body) {
  const text = String(body || "").trim().toLowerCase();
  
  // Regex die zoekt naar 'open' of 'close' gevolgd door een getal
  const match = text.match(/(open|close|sluit|dicht)\s*(\d+)/);
  
  if (!match) return { command: null, boxNr: null };

  let command = match[1];
  // Vertaling voor Nederlandse commando's
  if (command === "sluit" || command === "dicht") command = "close";

  return {
    command: command, // 'open' of 'close'
    boxNr: match[2]    // het nummer, bijv '1'
  };
}

/**
 * POST /api/sms
 * Het hoofdpunt waar Twilio de berichten naartoe stuurt
 */
router.post("/", async (req, res) => {
  try {
    // Twilio stuurt data in 'From' en 'Body' velden
    const rawFrom = req.body?.From ?? req.body?.from ?? null;
    const rawBody = req.body?.Body ?? req.body?.message ?? "";

    const from = normalizePhone(rawFrom);
    const { command, boxNr } = parseSmsBody(rawBody);

    console.log(`📩 Inkomende SMS van ${from}: "${rawBody}" -> Command: ${command}, Box: ${boxNr}`);

    // 1. Basis validatie
    if (!from) {
      return sendTwilioResponse(res, "Systeemfout: Afzender onbekend.");
    }

    if (!command || !boxNr) {
      return sendTwilioResponse(res, "Gebruik: 'open 1' of 'sluit 1' om een Gridbox te bedienen.");
    }

    // 2. Zoek actieve share in de database via sharesService
    // Deze functie checkt of dit nummer toegang heeft tot dit boxnummer
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    if (!share) {
      console.warn(`⚠️ Toegang geweigerd voor ${from} naar box ${boxNr}`);
      return sendTwilioResponse(res, `U heeft geen actieve toegang tot Gridbox ${boxNr}.`);
    }

    // 3. Optioneel: check op blokkering/verloop (als je service dit niet al doet)
    // De sharesService.deactivateExpiredShares job zou dit idealiter al moeten afvangen

    // 4. Voer de actie uit via de boxesService
    // Dit zet 'desired' op 'open' of 'close' in Firestore
    let result;
    if (command === "open") {
      result = await boxesService.openBox(share.boxId, "sms", from);
    } else {
      result = await boxesService.closeBox(share.boxId, "sms", from);
    }

    // 5. Bevestiging naar de gebruiker
    if (result?.success) {
      const actieText = command === "open" ? "geopend" : "gesloten";
      return sendTwilioResponse(res, `Gridbox ${boxNr} wordt nu ${actieText}.`);
    } else {
      return sendTwilioResponse(res, `Gridbox ${boxNr} is momenteel niet bereikbaar. Probeer het later opnieuw.`);
    }

  } catch (err) {
    console.error("❌ Kritieke fout in SMS Webhook:", err);
    return sendTwilioResponse(res, "Er is een technische fout opgetreden in het Gridbox platform.");
  }
});

export default router;
