// api/src/routes/smsWebhook.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/* =========================================================
   Helpers
   ========================================================= */

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

function parseCommand(rawText) {
  const text = String(rawText || "").trim().toLowerCase();
  const match = text.match(/(open|close|sluit|dicht)\s*(\d+)/);

  if (!match) return { command: null, boxNr: null };

  let command = match[1];
  if (command === "sluit" || command === "dicht") command = "close";

  return { command, boxNr: match[2] };
}

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

function resolveBoxId(share) {
  return share.boxId ?? share.box ?? share.portalId ?? share.boxRef ?? null;
}

/* =========================================================
   POST /api/sms
   ========================================================= */

router.post("/", async (req, res) => {
  console.log("📩 SMS webhook payload:", JSON.stringify(req.body, null, 2));

  try {
    /* ---------------- payload parsing ---------------- */

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

    /* ---------------- validatie ---------------- */

    if (!from || !isValidE164(from)) {
      return res.json({ ok: false, message: "Ongeldig nummer." });
    }

    if (!command || !boxNr) {
      return res.json({
        ok: false,
        message: "Gebruik: OPEN <nummer> of CLOSE <nummer>."
      });
    }

    /* ---------------- share lookup ---------------- */

    let share;
    try {
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } catch (e) {
      console.error("❌ sharesService error:", e);
      return res.json({
        ok: false,
        message: "Interne fout bij toegangscontrole."
      });
    }

    console.log("🔍 Share:", share);

    if (!share) {
      return res.json({
        ok: false,
        message: `U heeft geen toegang tot Gridbox ${boxNr}.`
      });
    }

    if (isShareBlocked(share)) {
      return res.json({
        ok: false,
        message: `Uw toegang tot Gridbox ${boxNr} is verlopen.`
      });
    }

    /* ---------------- boxId ---------------- */

    const boxId = resolveBoxId(share);

    if (!boxId) {
      console.error("❌ Geen boxId in share:", share);
      return res.json({
        ok: false,
        message: "Interne fout: box niet gevonden."
      });
    }

    console.log("📦 BoxId:", boxId);

    /* ---------------- open / close ---------------- */

    let result;
    try {
      if (command === "open") {
        result = await boxesService.openBox(boxId, {
          source: "sms",
          phone: from
        });
      } else {
        result = await boxesService.closeBox(boxId, {
          source: "sms",
          phone: from
        });
      }
    } catch (e) {
      console.error("❌ boxesService error:", e);
      return res.json({
        ok: false,
        message: "Interne fout bij uitvoeren box-actie."
      });
    }

    console.log("⚙️ boxesService result:", result);

    /* ---------------- resultaat ---------------- */

    if (!result || result.success !== true) {
      return res.json({
        ok: false,
        message: `Gridbox ${boxNr} reageert momenteel niet.`
      });
    }

    const actieText = command === "open" ? "geopend" : "gesloten";

    return res.json({
      ok: true,
      message: `Gridbox ${boxNr} wordt nu ${actieText}.`
    });

  } catch (err) {
    console.error("🔥 ONVERWACHTE CRASH:", err, err?.stack);
    return res.status(500).json({
      ok: false,
      message: "Onverwachte systeemfout."
    });
  }
});

export default router;
