// api/src/routes/smsWebhook.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/**
 * Telefoonnummer normaliseren naar internationaal formaat (+32...)
 */
function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim().replace(/\s+/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);

  return s || null;
}

/**
 * E.164 validatie
 */
function isValidE164(number) {
  return /^\+[1-9]\d{7,14}$/.test(number || "");
}

/**
 * Commando parser
 * Begrijpt:
 *  - open 5
 *  - open5
 *  - sluit 2
 *  - dicht 3
 */
function parseCommand(rawText) {
  const text = String(rawText || "").trim().toLowerCase();

  const match = text.match(/(open|close|sluit|dicht)\s*(\d+)/);

  if (!match) {
    return { command: null, boxNr: null };
  }

  let command = match[1];
  if (command === "sluit" || command === "dicht") command = "close";

  return {
    command,
    boxNr: match[2]
  };
}

/**
 * Share verlopen of geblokkeerd?
 */
function isShareBlocked(share) {
  if (!share?.blockedAt) return false;

  try {
    const blockedDate =
      typeof share.blockedAt.toDate === "function"
        ? share.blockedAt.toDate()
        : new Date(share.blockedAt);

    return new Date() >= blockedDate;
  } catch {
    return false;
  }
}

/**
 * POST /api/sms
 * Bird inbound SMS webhook
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 Bird webhook payload:", JSON.stringify(req.body, null, 2));

    // ===== Bird payload parsing =====
    const rawFrom =
      req.body?.sender?.identifierValue ??
      req.body?.sender?.value ??
      null;

    const rawText =
      req.body?.body?.text?.text ??
      req.body?.body?.text ??
      "";

    const from = normalizePhone(rawFrom);
    const { command, boxNr } = parseCommand(rawText);

    console.log(`📩 SMS ontvangen van ${from}: "${rawText}"`);

    // 1. Nummer valideren
    if (!from || !isValidE164(from)) {
      return res.status(200).json({ message: "Ongeldig nummer." });
    }

    // 2. Commando valideren
    if (!command || !boxNr) {
      return res.status(200).json({
        message: "Gebruik: OPEN 1 om Gridbox 1 te openen."
      });
    }

    // 3. Share zoeken
    const share = await sharesService.findActiveShareByPhoneAndBoxNumber(
      from,
      boxNr
    );

    if (!share) {
      console.log(`❌ Geen share voor ${from} op box ${boxNr}`);
      return res.status(200).json({
        message: `U heeft geen toegang tot Gridbox ${boxNr}.`
      });
    }

    if (isShareBlocked(share)) {
      return res.status(200).json({
        message: `Uw toegang tot Gridbox ${boxNr} is verlopen.`
      });
    }

    // 4. Actie uitvoeren
    const actionFn =
      command === "open"
        ? boxesService.openBox
        : boxesService.closeBox;

    const result = await actionFn(share.boxId, "sms", from);

    if (!result?.success) {
      return res.status(200).json({
        message: `Gridbox ${boxNr} is momenteel niet bereikbaar.`
      });
    }

    const actieText = command === "open" ? "geopend" : "gesloten";

    return res.status(200).json({
      message: `Gridbox ${boxNr} wordt nu ${actieText}.`
    });

  } catch (err) {
    console.error("❌ Bird SMS webhook error:", err);
    return res.status(200).json({
      message: "Systeemfout. Probeer later opnieuw."
    });
  }
});

export default router;
