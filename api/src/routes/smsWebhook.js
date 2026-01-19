// api/src/routes/smsWebhook.js
//
// Bird inbound webhook (geen Twilio)
//
// Doel
// - Inkomende sms of channel message verwerken
// - Command herkennen: "open 5" of "sluit 5"
// - Toegang checken via shares (phone + boxNumber + active + niet verlopen)
// - Command wegschrijven naar Firestore boxCommands (legacy flow)
//
// Vereiste env vars (Cloud Run)
// - BIRD_ACCESS_KEY (voor replies als SMS_REPLY_ENABLED aan staat)
//
// Optioneel
// - SMS_REPLY_ENABLED ("0" om geen reply sms te sturen, default aan)
// - LOG_SMS_PAYLOAD ("1" om payload volledig te loggen, let op privacy)
// - BIRD_WEBHOOK_SECRET (als je wilt beveiligen: stuur ?secret=... mee in de webhook URL)

import { Router, urlencoded, json } from "express";
import { db } from "../firebase.js";
import { sendSms } from "../services/birdSmsService.js";

const router = Router();

const SMS_VERSION = "sms-webhook-v6-bird-2026-01-19";

router.use(urlencoded({ extended: false }));
router.use(json());

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
    console.error("⚠️ Bird reply sms faalde", { to: maskPhone(to), error: r?.error || "unknown" });
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

/**
 * Bird webhooks gebruiken soms een wrapper rond de message:
 * - { data: {...} }
 * - { message: {...} }
 * - { payload: {...} }
 * Daarom nemen we altijd een "root" object dat de echte message bevat.
 */
function getWebhookRoot(req) {
  return req.body?.data ?? req.body?.message ?? req.body?.payload ?? req.body ?? {};
}

function getIncomingFrom(req) {
  const root = getWebhookRoot(req);

  // Bird Channels inbound (jouw Inspect log payload)
  // root.sender.contact.identifierValue = "+324..."
  const v =
    root?.sender?.contact?.identifierValue ??
    root?.sender?.contact?.platformAddress ??
    // extra fallbacks
    root?.sender?.identifierValue ??
    root?.sender?.value ??
    root?.from ??
    root?.sender ??
    root?.originator ??
    null;

  return v ? String(v).trim() : null;
}

function getIncomingText(req) {
  const root = getWebhookRoot(req);

  const v =
    // Bird Channels inbound: body.text.text
    root?.body?.text?.text ??
    root?.body?.text ??
    // extra fallbacks
    root?.message ??
    root?.text ??
    root?.body ??
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
  return "Gebruik: open 5 of sluit 5.";
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
  // index-vriendelijke query: phone + active, boxNr filteren in code
  const snap = await db.collection("shares").where("phone", "==", from).where("active", "==", true).get();
  if (snap.empty) return null;

  const shares = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const match = shares.find((s) => Number(s.boxNumber) === Number(boxNr));
  return match || null;
}

async function resolveBoxIdFromShareOrBoxes(share, boxNr) {
  const direct = share?.boxId ?? share?.box ?? share?.portalId ?? share?.boxRef ?? null;
  if (direct) return String(direct);

  // fallback: zoek box op BoxNumber
  const snap = await db.collection("boxes").where("Portal.BoxNumber", "==", Number(boxNr)).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function queueBoxCommand(boxId, type, meta = {}) {
  const payload = {
    commandId: `cmd-${Date.now()}`,
    type,
    status: "pending",
    createdAt: new Date(),
    meta: {
      source: "sms",
      ...meta
    }
  };

  await db.collection("boxCommands").doc(String(boxId)).set(payload);
  return { success: true };
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

  const root = getWebhookRoot(req);

  if (process.env.LOG_SMS_PAYLOAD === "1") {
    console.log("📩 SMS payload (raw):", JSON.stringify(req.body, null, 2));
    console.log("📩 SMS payload (root):", JSON.stringify(root, null, 2));
  }

  const rawFrom = getIncomingFrom(req);
  const rawText = getIncomingText(req);

  const from = normalizePhone(rawFrom);
  const { command, boxNr } = parseCommand(rawText);

  // Extra debug (veilig): we maskeren het nummer en tonen de eerste 50 chars van de tekst
  console.log("➡️ SMS parsed", {
    from: maskPhone(from),
    command,
    boxNr,
    rawFrom: rawFrom ? maskPhone(rawFrom) : null,
    rawTextPreview: String(rawText || "").slice(0, 50)
  });

  try {
    if (!from) {
      return apiFail(res, "Ongeldig nummer of afzender onbekend.");
    }

    if (!command || !boxNr) {
      await replySmsIfEnabled(from, usageText());
      return apiFail(res, usageText(), { received: String(rawText || "").slice(0, 160) });
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

    if (!result || result.success !== true) {
      const msg = `Gridbox ${boxNr} reageert momenteel niet.`;
      await replySmsIfEnabled(from, msg);
      return apiFail(res, msg);
    }

    const actieText = command === "open" ? "geopend" : "gesloten";
    const msg = `Gridbox ${boxNr} wordt nu ${actieText}.`;

    await replySmsIfEnabled(from, msg);
    return apiOk(res, msg, { boxId, boxNr, command });
  } catch (err) {
    console.error("🔥 sms webhook crash", err);
    return res.status(500).json({ ok: false, version: SMS_VERSION, message: "Interne serverfout" });
  }
});

export default router;
