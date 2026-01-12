import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

// Zorg dat we zowel Twilio-data (urlencoded) als JSON kunnen lezen
router.use(urlencoded({ extended: false }));
router.use(json());

/**
 * Telefoonnummer normaliseren naar internationaal E.164 formaat
 */
function normalizePhone(number) {
  if (!number) return null;
  let s = String(number).trim().replace(/\s+/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  return s || null;
}

/**
 * Controleert of een nummer voldoet aan het internationale formaat (+32...)
 */
function isValidE164(number) {
  return /^\+[1-9]\d{7,14}$/.test(number || "");
}

/**
 * Antwoord helper: stuurt XML naar Twilio of JSON naar de rest
 */
function sendResponse(req, res, message) {
  const isTwilio = req.headers["x-twilio-signature"] || req.is("application/x-www-form-urlencoded");

  if (isTwilio) {
    const safe = String(message || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return res.status(200).type("text/xml").send(`<Response><Message>${safe}</Message></Response>`);
  }
  return res.status(200).json({ message });
}

/**
 * Commando parser: begrijpt "open 1", "open1", "sluit 2", etc.
 */
function parseCommand(rawBody) {
  const text = String(rawBody || "").trim().toLowerCase();
  
  // Zoekt naar actie + getal
  const match = text.match(/(open|close|sluit|dicht)\s*(\d+)/);
  
  if (match) {
    let command = match[1];
    if (command === "sluit" || command === "dicht") command = "close";
    
    return {
      command: command, // 'open' of 'close'
      boxNr: match[2]    // het nummer, bijv '1'
    };
  }
  return { command: null, boxNr: null };
}

/**
 * Check of een share geblokkeerd of verlopen is
 */
function isShareBlocked(share) {
  if (!share?.blockedAt) return false;
  const now = new Date();
  try {
    const blockedDate = typeof share.blockedAt.toDate === "function" 
      ? share.blockedAt.toDate() 
      : new Date(share.blockedAt);
    return now >= blockedDate;
  } catch {
    return false;
  }
}

/**
 * POST /api/sms
 * Twilio Webhook Endpoint
 */
router.post("/", async (req, res) => {
  try {
    const rawFrom = req.body?.From ?? req.body?.from ?? null;
    const rawBody = req.body?.Body ?? req.body?.message ?? "";

    const from = normalizePhone(rawFrom);
    const { command, boxNr } = parseCommand(rawBody);

    console.log(`📩 SMS Ontvangen: Van=${from}, Bericht="${rawBody}"`);

    // 1. Validatie van nummer
    if (!from || !isValidE164(from)) {
      return sendResponse(req, res, "Fout: Ongeldig nummer.");
    }

    // 2. Validatie van commando
    if (!command || !boxNr) {
      return sendResponse(req, res, "Gebruik: 'open 1' om Gridbox 1 te openen.");
    }

    // 3. Controleer toegang in Firestore via sharesService
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    if (!share) {
      console.log(`❌ Geen toegang voor ${from} tot box ${boxNr}`);
      return sendResponse(req, res, `U heeft geen toegang tot Gridbox ${boxNr}.`);
    }

    if (isShareBlocked(share)) {
      return sendResponse(req, res, `Uw toegang tot Gridbox ${boxNr} is verlopen.`);
    }

    // 4. Actie uitvoeren via boxesService
    const serviceAction = command === "open" ? boxesService.openBox : boxesService.closeBox;
    const result = await serviceAction(share.boxId, "sms", from);

    if (!result?.success) {
      return sendResponse(req, res, `Gridbox ${boxNr} is momenteel niet bereikbaar.`);
    }

    // Bevestiging naar gebruiker
    const actieText = command === "open" ? "geopend" : "gesloten";
    return sendResponse(req, res, `Gridbox ${boxNr} wordt nu ${actieText}.`);

  } catch (err) {
    console.error("❌ SMS Webhook Error:", err);
    return sendResponse(req, res, "Systeemfout. Probeer het later opnieuw.");
  }
});

export default router;
