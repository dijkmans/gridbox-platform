import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

// Body parsers voor Twilio (urlencoded) en JSON
router.use(urlencoded({ extended: false }));
router.use(json());

/**
 * Telefoonnummer normaliseren naar E.164 formaat
 */
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

/**
 * TwiML XML Helper
 */
function sendResponse(req, res, message) {
  const isTwilio = req.headers["x-twilio-signature"] || req.is("application/x-www-form-urlencoded");

  if (isTwilio) {
    const safe = String(message || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return res.status(200).type("text/xml").send(`<Response><Message>${safe}</Message></Response>`);
  }
  return res.status(200).json({ message });
}

/**
 * Verbeterde Commando parser voor "open 1" of "open1"
 */
function parseCommand(rawBody) {
  const text = String(rawBody || "").trim().toLowerCase();
  
  // Zoek naar 'open' of 'close' gevolgd door een getal
  const match = text.match(/(open|close)\s*(\d+)/);
  
  if (match) {
    return {
      command: match[1], // 'open' of 'close'
      boxNr: match[2]    // het nummer, bijv '1'
    };
  }
  return { command: null, boxNr: null };
}

/**
 * Check of share nog geldig is
 */
function isShareBlocked(share) {
  if (!share?.blockedAt) return false;
  const now = new Date();
  try {
    const blockedDate = typeof share.blockedAt.toDate === "function" ? share.blockedAt.toDate() : new Date(share.blockedAt);
    return now >= blockedDate;
  } catch {
    return false;
  }
}

/**
 * POST /api/sms/inbound
 */
router.post("/", async (req, res) => {
  try {
    const rawFrom = req.body?.From ?? req.body?.from ?? null;
    const rawBody = req.body?.Body ?? req.body?.message ?? "";

    const from = normalizePhone(rawFrom);
    const { command, boxNr } = parseCommand(rawBody);

    console.log("📩 SMS Verwerking:", { from, command, boxNr });

    // 1. Validatie van nummer
    if (!from || !isValidE164(from)) {
      return sendResponse(req, res, "Systeemfout: Ongeldig nummer.");
    }

    // 2. Validatie van commando
    if (!command || !boxNr) {
      return sendResponse(req, res, "Gebruik: 'open 1' om Gridbox 1 te openen.");
    }

    // 3. Zoek actieve share in Firestore via jouw sharesService
    // Let op: zorg dat sharesService.findActiveShareByPhoneAndBoxNumber(phone, boxNr) bestaat
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    if (!share) {
      return sendResponse(req, res, `Geen toegang tot Gridbox ${boxNr}.`);
    }

    if (isShareBlocked(share)) {
      return sendResponse(req, res, `Toegang tot Gridbox ${boxNr} is verlopen.`);
    }

    // 4. Uitvoeren van de actie
    const serviceAction = command === "open" ? boxesService.openBox : boxesService.closeBox;
    const result = await serviceAction(share.boxId, "sms", from);

    if (!result?.success) {
      return sendResponse(req, res, `Gridbox ${boxNr} is momenteel niet bereikbaar.`);
    }

    return sendResponse(req, res, `Gridbox ${boxNr} wordt nu ge${command === "open" ? "opend" : "sloten"}.`);

  } catch (err) {
    console.error("❌ SMS Webhook Error:", err);
    return sendResponse(req, res, "Er is een technische fout opgetreden.");
  }
});

export default router;
