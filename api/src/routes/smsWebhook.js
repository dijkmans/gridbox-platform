import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

// Zorg dat deze route altijd bodies kan lezen
router.use(urlencoded({ extended: false }));
router.use(json());

/**
 * Telefoonnummer normaliseren
 * - verwijdert spaties
 * - 00... -> +...
 * - 0... (BE) -> +32...
 */
function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim().replace(/\s+/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);

  return s || null;
}

function isValidE164(number) {
  if (!number) return false;
  return /^\+[1-9]\d{7,14}$/.test(number);
}

/**
 * XML escapen (TwiML)
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
 * Controleert of een share effectief geblokkeerd is
 * (enkel op basis van blockedAt)
 */
function isShareBlocked(share) {
  if (!share || !share.blockedAt) return false;

  const now = new Date();

  try {
    if (typeof share.blockedAt?.toDate === "function") {
      return now >= share.blockedAt.toDate();
    }

    const blockedAt = new Date(share.blockedAt);
    if (isNaN(blockedAt.getTime())) return false;

    return now >= blockedAt;
  } catch {
    return false;
  }
}

/**
 * Antwoord helper
 * - JSON voor simulator / interne clients
 * - XML voor Twilio
 */
function sendResponse(res, message, isSimulator) {
  if (isSimulator) {
    return res.status(200).json({ reply: message });
  }

  const safe = escapeXml(message);

  return res
    .status(200)
    .type("text/xml")
    .send(`<Response><Message>${safe}</Message></Response>`);
}

/**
 * Parse "open", "close", "open 2", "close 10"
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
 * Zonder boxNr: zoek automatisch een actieve share door boxnummers te scannen.
 * Max aantal te scannen boxes via env: SMS_BOX_SCAN_MAX (default 20)
 */
async function findFirstActiveShareByPhone(from) {
  const max = Number(process.env.SMS_BOX_SCAN_MAX || 20);
  const scanMax = Number.isFinite(max) && max > 0 ? Math.min(max, 200) : 20;

  for (let i = 1; i <= scanMax; i++) {
    // eslint-disable-next-line no-await-in-loop
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(
      from,
      String(i)
    );

    if (share) {
      return { share, boxNr: String(i) };
    }
  }

  return { share: null, boxNr: null };
}

/**
 * POST /api/sms
 * Enige ingang voor:
 * - SMS simulator (JSON + X-Simulator header)
 * - Twilio (form-urlencoded)
 */
router.post("/", async (req, res) => {
  try {
    //ा
    // 0. Kanaal bepalen
    const isSimulator =
      req.headers["x-simulator"] === "true" ||
      req.is("application/json");

    // 1. Input normaliseren
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

    console.log("📩 SMS inbound:", {
      from,
      body,
      simulator: isSimulator
    });

    // From check
    if (!from || !isValidE164(from)) {
      return sendResponse(res, "Ongeldig nummer.", isSimulator);
    }

    // 2. Commando parsen
    const { command, arg } = parseCommand(body);

    if (!["open", "close"].includes(command)) {
      return sendResponse(
        res,
        "Gebruik: OPEN of CLOSE. Optioneel: OPEN <nummer> of CLOSE <nummer>.",
        isSimulator
      );
    }

    // 3. BoxNr en Share bepalen
    let boxNr = null;
    let share = null;

    // Als user een nummer meegeeft: gebruik dat
    if (arg && /^\d+$/.test(arg)) {
      boxNr = String(Number(arg)); // "02" -> "2"
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } else {
      // Geen nummer: zoek automatisch
      const found = await findFirstActiveShareByPhone(from);
      share = found.share;
      boxNr = found.boxNr;
    }

    if (!share || !boxNr) {
      return sendResponse(
        res,
        "Geen toegang. Gebruik: OPEN <nummer> of CLOSE <nummer>.",
        isSimulator
      );
    }

    // 4. Blokkering controleren
    if (isShareBlocked(share)) {
      return sendResponse(
        res,
        `Uw toegang tot Gridbox ${boxNr} is verlopen.`,
        isSimulator
      );
    }

    // 5. Box ophalen
    const box = await boxesService.getById(share.boxId);

    if (!box) {
      return sendResponse(res, "Gridbox niet gevonden.", isSimulator);
    }

    // 6. OPEN
    if (command === "open") {
      const result = await boxesService.openBox(share.boxId, "sms", from);

      if (!result || !result.success) {
        return sendResponse(
          res,
          `Gridbox ${boxNr} kan niet worden geopend.`,
          isSimulator
        );
      }

      return sendResponse(res, `Gridbox ${boxNr} wordt geopend.`, isSimulator);
    }

    // 7. CLOSE
    if (command === "close") {
      const result = await boxesService.closeBox(share.boxId, "sms", from);

      if (!result || !result.success) {
        return sendResponse(
          res,
          `Gridbox ${boxNr} kan niet worden gesloten.`,
          isSimulator
        );
      }

      return sendResponse(res, `Gridbox ${boxNr} wordt gesloten.`, isSimulator);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ smsWebhook error:", err);

    return sendResponse(
      res,
      "Er ging iets mis.",
      req.headers["x-simulator"] === "true"
    );
  }
});

export default router;

