// api/src/routes/smsWebhook.js
//
// Bird first:
// - Inkomende sms komt via Bird als JSON (meestal sender.identifierValue + body.text.text)
// - We antwoorden altijd met JSON, want Bird verwacht geen TwiML
// - We laten wel Twilio velden (From, Body) als fallback toe voor test-calls

import { Router, urlencoded, json } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

router.use(urlencoded({ extended: false }));
router.use(json());

/* =========================
   Helpers
   ========================= */

function send(res, ok, message, extra = {}) {
  return res.status(200).json({ ok, message, ...extra });
}

function getIncomingFrom(req) {
  return (
    req.body?.sender?.identifierValue ??
    req.body?.sender?.value ??
    req.body?.from ??
    req.body?.From ??
    req.body?.sender ??
    null
  );
}

function getIncomingBody(req) {
  const v =
    req.body?.body?.text?.text ??
    req.body?.body?.text ??
    req.body?.message ??
    req.body?.text ??
    req.body?.Body ??
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

  if (s.toLowerCase().startsWith("whatsapp:")) {
    s = s.slice("whatsapp:".length);
  }

  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) s = "+" + s;

  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;

  return s;
}

function parseSmsCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

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
  return "Gebruik: open 5 of sluit 5.";
}

function resolveBoxId(share) {
  return share?.boxId ?? share?.box ?? share?.portalId ?? share?.boxRef ?? null;
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

function isShareExpiredOrBlocked(share) {
  const now = Date.now();

  const blockedAtMs = toMillis(share?.blockedAt);
  if (blockedAtMs && now >= blockedAtMs) return true;

  const expiresAtMs = toMillis(share?.expiresAt);
  if (expiresAtMs && now >= expiresAtMs) return true;

  return false;
}

/* =========================
   POST /api/sms
   ========================= */

router.post("/", async (req, res) => {
  const rawFrom = getIncomingFrom(req);
  const rawBody = getIncomingBody(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseSmsCommand(rawBody);

  console.log("📩 SMS webhook binnen", {
    rawFrom,
    from,
    rawBody: String(rawBody).slice(0, 200),
    command,
    boxNr
  });

  try {
    if (!from) {
      return send(res, false, "Afzender onbekend of ongeldig nummerformaat.");
    }

    if (!command || !boxNr) {
      return send(res, false, usageText());
    }

    if (boxNr < 1 || boxNr > 999) {
      return send(res, false, "Ongeldig boxnummer.");
    }

    let share;
    try {
      share = await sharesService.findActiveShareByPhoneAndBoxNumber(from, boxNr);
    } catch (e) {
      console.error("❌ sharesService error:", e);
      return send(res, false, "Interne fout bij toegangscontrole.");
    }

    if (!share) {
      console.warn("⚠️ Toegang geweigerd", { from, boxNr });
      return send(res, false, `U heeft geen toegang tot Gridbox ${boxNr}.`);
    }

    if (isShareExpiredOrBlocked(share)) {
      return send(res, false, `Uw toegang tot Gridbox ${boxNr} is verlopen.`);
    }

    const boxId = resolveBoxId(share);
    if (!boxId) {
      console.error("❌ Share heeft geen boxId", { shareId: share?.id, share });
      return send(res, false, "Interne fout: box koppeling ontbreekt.");
    }

    let result;
    try {
      if (command === "open") {
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
      return send(res, false, "Interne fout bij uitvoeren box-actie.");
    }

    if (!result || result.success !== true) {
      return send(res, false, `Gridbox ${boxNr} reageert momenteel niet.`);
    }

    const actieText = command === "open" ? "geopend" : "gesloten";
    return send(res, true, `Gridbox ${boxNr} wordt nu ${actieText}.`, { boxId });

  } catch (err) {
    console.error("🔥 ONVERWACHTE CRASH:", err, err?.stack);
    return res.status(500).json({ ok: false, message: "Onverwachte systeemfout." });
  }
});

export default router;
