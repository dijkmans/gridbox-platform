// api/src/routes/smsWebhook.js
//
// Bird inbound webhook (geen Twilio)
//
// Doel
// - Inkomende sms verwerken (Bird Channels sms.inbound)
// - Command herkennen: "open 5" of "sluit 5"
// - Toegang checken via shares (phone + boxNumber + active + niet verlopen)
// - Command wegschrijven naar Firestore
//   Standaard (veilig): zowel legacy als nieuw
//   Legacy: boxCommands/<boxId> (1 document)
//   Nieuw:   boxes/<boxId>/commands/<autoId>
//
// Vereiste env vars (Cloud Run)
// - BIRD_ACCESS_KEY (voor replies)
//
// Optioneel
// - SMS_REPLY_ENABLED ("0" om geen reply sms te sturen, default aan)
// - LOG_SMS_PAYLOAD ("1" om payload volledig te loggen, let op privacy)
// - BIRD_WEBHOOK_SECRET (als je wilt beveiligen: stuur ?secret=... mee in de webhook URL)
// - COMMAND_WRITE_MODE ("both" | "legacy" | "new") default "both"

import { Router, urlencoded, json } from "express";
import { db } from "../firebase.js";
import { sendSms } from "../services/birdSmsService.js";

const router = Router();

const SMS_VERSION = "sms-webhook-v7-bird-2026-01-19";

// Bird webhooks kunnen komen als application/json, application/*+json, cloudevents, enz.
// Daarom zetten we json parser breder, anders krijg je lege req.body en dus from:''.
router.use(urlencoded({ extended: false }));
router.use(
  json({
    type: ["application/json", "application/*+json", "application/cloudevents+json", "*/*"]
  })
);

function apiOk(res, message, extra = {}) {
  return res.status(200).json({ ok: true, version: SMS_VERSION, message, ...extra });
}

function apiFail(res, message, extra = {}) {
  return res.status(200).json({ ok: false, version: SMS_VERSION, message, ...extra });
}

function maskPhone(p) {
  const s = String(p || "");
  if (s.length < 6) return s;
  return s.slice(0, 4) + "..." + s.slice(-2);
}

function isReplyEnabled() {
  const v = String(process.env.SMS_REPLY_ENABLED ?? "").trim().toLowerCase();
  if (!v) return true;
  return !(v === "0" || v === "false" || v === "no");
}

async function replySmsIfEnabled(to, text) {
  if (!isReplyEnabled()) return;

  const r = await sendSms({ to, body: text });
  if (!r?.ok) {
    console.error("⚠️ Bird reply sms faalde", {
      to: maskPhone(to),
      error: r?.error || "unknown"
    });
  }
}

function normalizePhone(number) {
  if (!number) return null;

  let s = String(number).trim();

  if (s.toLowerCase().startsWith("whatsapp:")) s = s.slice("whatsapp:".length);

  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+32" + s.slice(1);
  if (!s.startsWith("+") && /^\d{9,15}$/.test(s)) s = "+" + s;

  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

// Bird webhooks kunnen het message object direct sturen, of in een wrapper onder "data"
// CloudEvents voorbeeld: { specversion, type, source, id, time, data: { ...message... } }
function getBirdPayload(req) {
  return req.body?.data ?? req.body ?? {};
}

function getIncomingFrom(req) {
  const b = getBirdPayload(req);

  // Bird sms.inbound payload (zoals jij stuurde)
  // sender.contact.identifierValue = "+324..."
  const v =
    b?.sender?.contact?.identifierValue ??
    b?.sender?.contact?.platformAddress ??
    b?.sender?.identifierValue ??
    b?.from ??
    b?.sender ??
    b?.originator ??
    null;

  return v ? String(v).trim() : null;
}

function getIncomingText(req) {
  const b = getBirdPayload(req);

  const v =
    b?.body?.text?.text ??
    b?.body?.text ??
    b?.body ??
    b?.message ??
    b?.text ??
    "";

  if (typeof v === "string") return v;

  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}

function parseCommand(rawText) {
  const text = String(rawText ?? "").trim().toLowerCase();

  // herkent: open 1, openen 1, sluit 1, dicht 1, toe 1, close 1
  const m = text.match(/\b(open|openen|close|sluit|dicht|toe)\b\s*[-:]?\s*(\d{1,3})\b/);
  if (!m) return { command: null, boxNr: null };

  let command = m[1];
  const boxNr = parseInt(m[2], 10);

  if (!Number.isFinite(boxNr)) return { command: null, boxNr: null };

  if (command === "openen") command = "open";
  if (command === "sluit" || command === "dicht" || command === "toe") command = "close";

  if (command !== "open" && command !== "close") return { command: null, boxNr: null };
  return { command, boxNr };
}

function usageText() {
  return "Gebruik: OPEN 5 of SLUIT 5.";
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

function isShareBlockedOrExpired(share) {
  const now = Date.now();

  const blockedAtMs = toMillis(share?.blockedAt);
  if (blockedAtMs && now >= blockedAtMs) return true;

  const expiresAtMs = toMillis(share?.expiresAt);
  if (expiresAtMs && now >= expiresAtMs) return true;

  return false;
}

async function findActiveShare(from, boxNr) {
  // index vriendelijk: phone + active, boxNr filteren in code
  const snap = await db.collection("shares").where("phone", "==", from).where("active", "==", true).get();
  if (snap.empty) return null;

  const shares = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const match = shares.find((s) => Number(s.boxNumber) === Number(boxNr));
  return match || null;
}

async function resolveBoxIdFromShareOrBoxes(share, boxNr) {
  const direct = share?.boxId ?? share?.box ?? share?.portalId ?? share?.boxRef ?? null;
  if (direct) return String(direct);

  const snap = await db.collection("boxes").where("Portal.BoxNumber", "==", Number(boxNr)).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

function getCommandWriteMode() {
  const v = String(process.env.COMMAND_WRITE_MODE ?? "").trim().toLowerCase();
  if (!v) return "both";
  if (v === "legacy" || v === "new" || v === "both") return v;
  return "both";
}

async function queueCommandLegacy(boxId, type, meta = {}) {
  // Legacy structuur: boxCommands/<boxId>
  // Dit matcht wat je agent vroeger las: status "pending", type "open"
  const payload = {
    commandId: `cmd-${Date.now()}`,
    type, // "open" of "close"
    status: "pending",
    createdAt: new Date(),
    meta: {
      source: "sms",
      ...meta
    }
  };

  await db.collection("boxCommands").doc(String(boxId)).set(payload);
  return { ok: true, legacyDocId: String(boxId) };
}

async function queueCommandNew(boxId, type, meta = {}) {
  // Nieuwe structuur: boxes/<boxId>/commands/<autoId>
  const cmd = {
    type, // "open" of "close"
    status: "queued",
    source: "sms",
    createdAt: new Date(),
    ...meta
  };

  const ref = await db.collection("boxes").doc(String(boxId)).collection("commands").add(cmd);
  return { ok: true, commandDocId: ref.id };
}

async function queueBoxCommand(boxId, type, meta = {}) {
  const mode = getCommandWriteMode();

  const out = { success: true };

  if (mode === "legacy" || mode === "both") {
    const r1 = await queueCommandLegacy(boxId, type, meta);
    out.legacyDocId = r1.legacyDocId;
  }

  if (mode === "new" || mode === "both") {
    const r2 = await queueCommandNew(boxId, type, meta);
    out.commandDocId = r2.commandDocId;
  }

  return out;
}

function checkWebhookSecret(req) {
  const secret = String(process.env.BIRD_WEBHOOK_SECRET || "").trim();
  if (!secret) return true;

  const got =
    String(req.query?.secret || "").trim() ||
    String(req.headers["x-gridbox-secret"] || "").trim();

  return got === secret;
}

router.post("/", async (req, res) => {
  if (!checkWebhookSecret(req)) {
    return res.status(401).json({ ok: false, version: SMS_VERSION, message: "Unauthorized" });
  }

  if (process.env.LOG_SMS_PAYLOAD === "1") {
    console.log("📩 SMS payload:", JSON.stringify(req.body, null, 2));
  }

  const rawFrom = getIncomingFrom(req);
  const rawText = getIncomingText(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseCommand(rawText);

  console.log("➡️ SMS parsed", {
    from: maskPhone(from),
    command,
    boxNr,
    rawFrom: rawFrom ? String(rawFrom).slice(0, 60) : null,
    rawTextPreview: String(rawText || "").slice(0, 80)
  });

  try {
    if (!from) {
      return apiFail(res, "Ongeldig nummer of afzender onbekend.");
    }

    if (!command || !boxNr) {
      await replySmsIfEnabled(from, usageText());
      return apiFail(res, usageText());
    }

    if (boxNr < 1 || boxNr > 999) {
      await replySmsIfEnabled(from, "Ongeldig boxnummer.");
      return apiFail(res, "Ongeldig boxnummer.");
    }

    const share = await findActiveShare(from, boxNr);
    if (!share) {
      const msg = `U heeft geen toegang tot Gridbox ${boxNr}.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    if (isShareBlockedOrExpired(share)) {
      const msg = `Uw toegang tot Gridbox ${boxNr} is verlopen.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    const boxId = await resolveBoxIdFromShareOrBoxes(share, boxNr);
    if (!boxId) {
      const msg = "Interne fout: box koppeling ontbreekt.";
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    const result = await queueBoxCommand(boxId, command === "open" ? "open" : "close", {
      phone: from,
      boxNr
    });

    if (!result?.success) {
      const msg = `Gridbox ${boxNr} reageert momenteel niet.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    const msg = `Gridbox ${boxNr} wordt nu ${command === "open" ? "geopend" : "gesloten"}.`;
    await replySmsIfEnabled(from, msg);

    return apiOk(res, msg, {
      boxId,
      boxNr,
      command,
      legacyDocId: result.legacyDocId ?? null,
      commandDocId: result.commandDocId ?? null,
      writeMode: getCommandWriteMode()
    });
  } catch (err) {
    console.error("🔥 sms webhook crash", err);
    return res.status(500).json({ ok: false, version: SMS_VERSION, message: "Interne serverfout" });
  }
});

export default router;
