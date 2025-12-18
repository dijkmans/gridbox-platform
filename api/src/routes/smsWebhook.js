import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

// bodies kunnen lezen (Twilio + JSON providers)
router.use(urlencoded({ extended: false }));
router.use(json());

/**
 * Telefoonnummer normaliseren
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
 * XML escapen (alleen nodig voor Twilio)
 */
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Antwoord versturen
 * - Twilio → TwiML (XML)
 * - andere providers → JSON
 */
function sendResponse(req, res, message) {
  // message is ALTIJD pure tekst (bv: OPEN <nummer>)
  const isTwilio =
    req.headers["x-twilio-signature"] ||
    req.is("application/x-www-form-urlencoded");

  if (isTwilio) {
    const safe = escapeXml(message);
    return res
      .status(200)
      .type("text/xml")
      .send(`<Response><Message>${safe}</Message></Response>`);
  }

  // generiek / future-proof
  return res.status(200).json({ message });
}

/**
 * Commando parser
 */
function parseCommand(rawBody) {
  const parts = String(rawBody || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return {
    command: parts[0] || "",
    arg: parts[1] || ""
  };
}

/**
 * Share blokkering check
 */
function isShareBlocked(share) {
  if (!share?.blockedAt) return false;

  const now = new Date();

  try {
    if (typeof share.blockedAt.toDate === "function") {
      return now >= share.blockedAt.toDate();
    }
    return now >= new Date(share.blockedAt);
  } catch {
    return false;
  }
}

/**
 * POST /api/sms
 * Eén endpoint, productie-waardig
 */
router.post("/", async (req, res) => {
  try {
    const rawFrom =
      req.body?.From ??
      req.body?.from ??
      req.body?.phone ??
      null;

    const rawBody =
      req.body?.Body ??
      req.body?.body ??
      req.body?.message ??
      "";

    const from = normalizePhone(rawFrom);
    const body = String(rawBody || "").trim();

    console.log("📩 SMS inbound:", { from, body });

    if (!from || !isValidE164(from)) {
      return sendResponse(req, res, "Ongeldig nummer.");
    }

    const { command, arg } = parseCommand(body);

    // SMS-CONTRACT: nummer is altijd verplicht
    if (
      !["open", "close"].includes(command) ||
      !arg ||
      !/^\d+$/.test(arg)
    ) {
      return sendResponse(
        req,
        res,
        "Gebruik: OPEN <nummer> of CLOSE <nummer>."
      );
    }

    const boxNr = String(Number(arg));
    const share =
      await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    if (!share) {
      return sendResponse(
        req,
        res,
        "Geen toegang. Gebruik: OPEN <nummer> of CLOSE <nummer>."
      );
    }

    if (isShareBlocked(share)) {
      return sendResponse(
        req,
        res,
        `Uw toegang tot Gridbox ${boxNr} is verlopen.`
      );
    }

    const box = await boxesService.getById(share.boxId);

    if (!box) {
      return sendResponse(req, res, "Gridbox niet gevonden.");
    }

    if (command === "open") {
      const result = await boxesService.openBox(
        share.boxId,
        "sms",
        from
      );

      if (!result?.success) {
        return sendResponse(
          req,
          res,
          `Gridbox ${boxNr} kan niet worden geopend.`
        );
      }

      return sendResponse(
        req,
        res,
        `Gridbox ${boxNr} wordt geopend.`
      );
    }

    if (command === "close") {
      const result = await boxesService.closeBox(
        share.boxId,
        "sms",
        from
      );

      if (!result?.success) {
        return sendResponse(
          req,
          res,
          `Gridbox ${boxNr} kan niet worden gesloten.`
        );
      }

      return sendResponse(
        req,
        res,
        `Gridbox ${boxNr} wordt gesloten.`
      );
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ smsWebhook error:", err);
    return sendResponse(req, res, "Er ging iets mis.");
  }
});

export default router;
