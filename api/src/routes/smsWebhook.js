// api/src/routes/smsWebhook.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/* =========================================================
   Helpers
   ========================================================= */

/**
 * Telefoonnummer normaliseren naar +32…
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
 *  open 1
 *  open1
 *  sluit 2
 *  dicht 3
 */
function parseCommand(rawText) {
  const text = String(rawText || "").trim().toLowerCase();
  const match = text.match(/(open|close|sluit|dicht)\s*(\d+)/);

  if (!match) return { command: null, boxNr: null };

  let command = match[1];
  if (command === "sluit" || command === "dicht") command = "close";

  return { command, boxNr: match[2] };
}

/**
 * Share verlopen of geblokkeerd?
 */
function isShareBlocked(share) {
  if (!share?.blockedAt) return false;

  try {
    const blockedDate =
      typeof share.blockedAt?.toDate === "function"
        ? share.blockedAt.toDate()
        : new Date(share.blockedAt);

    return new Date() >= blockedDate;
  } catch {
    return false;
  }
}

/**
 * BoxId robuust afleiden uit share
 */
function resolveBoxId(share) {
  return (
    share.boxId ||
    share.box ||
    share.portalId ||
    share.boxRef ||
    null
  );
}

/* =========================================================
   POST /api/sms
   Bird inbound SMS webhook
   ========================================================= */

router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook payload:", JSON.stringify(req.body, null, 2));

    /* -----------------------------------------
       Payload parsing (Bird + test JSON)
       ----------------------------------------- */

    const rawFrom =
      req.body?.sender?.identifierValue ??
      req.body?.sender?.value ??
      req.body?.from ??
      null;

    const rawText =
      req.body?.body?.text?.text ??
      req.body?.body?.text ??
      req.body?.message ??
      "";

    const from = normalizePhone(rawFrom);
    const { command, boxNr } = parseCommand(rawText);

    console.log("➡️ Parsed:", { from, command, boxNr });

    /* -----------------------------------------
       Validatie
       ----------------------------------------- */

    if (!from || !isValidE164(from)) {
      return res.json({ message: "Ongeldig nummer." });
    }

    if (!command || !boxNr) {
      return res.json({
        message: "Gebruik: OPEN <nummer> of CLOSE <nummer>."
      });
    }

    /* -----------------------------------------
       Share zoeken
       ----------------------------------------- */

    const share =
      await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);

    console.log("🔍 Share:", share);

    if (!share) {
      return res.json({
        message: `U heeft geen toegang tot Gridbox ${boxNr}.`
      });
    }

    if (isShareBlocked(share)) {
      return res.json({
        message: `Uw toegang tot Gridbox ${boxNr} is verlopen.`
      });
    }

    /* -----------------------------------------
       BoxId bepalen
       ----------------------------------------- */

    const boxId = resolveBoxId(share);

    if (!boxId) {
      console.error("❌ Geen boxId in share:", share);
      return res.json({
        message: "Interne fout: box niet gevonden."
      });
    }

    console.log("📦 BoxId resolved:", boxId);

    /* -----------------------------------------
       Actie uitvoeren
       ----------------------------------------- */

    const actionFn =
      command === "open"
        ? boxesService.openBox
        : boxesService.closeBox;

    const result = await actionFn(boxId, "sms", from);

    console.log("⚙️ open/close result:", result);

    if (!result?.success) {
      return res.json({
        message: `Gridbox ${boxNr} is momenteel niet bereikbaar.`
      });
    }

    const actieText = command === "open" ? "geopend" : "gesloten";

    return res.json({
      message: `Gridbox ${boxNr} wordt nu ${actieText}.`
    });

  } catch (err) {
    console.error("❌ SMS webhook crash:", err, err?.stack);
    return res.json({
      message: "Systeemfout. Probeer later opnieuw."
    });
  }
});

export default router;
