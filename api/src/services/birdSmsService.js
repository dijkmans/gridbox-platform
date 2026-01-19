// api/src/services/birdSmsService.js
//
// Centrale SMS service via Bird
//
// Werking
// - Als BIRD_SMS_WORKSPACE_ID en BIRD_SMS_CHANNEL_ID bestaan: gebruik Bird Channels API (app.bird.com)
// - Anders: fallback naar MessageBird legacy SMS API (rest.messagebird.com/messages)
//
// Vereiste env vars (Channels)
// - BIRD_ACCESS_KEY
// - BIRD_SMS_WORKSPACE_ID
// - BIRD_SMS_CHANNEL_ID
//
// Vereiste env vars (Legacy fallback)
// - BIRD_ACCESS_KEY
// - BIRD_ORIGINATOR
//
// Optioneel
// - BIRD_CHANNELS_API_BASE (default https://api.bird.com)
// - BIRD_API_BASE          (default https://rest.messagebird.com)
// - BIRD_TIMEOUT_MS        (default 10000)
// - BIRD_DRY_RUN           ("1" of "true")

import https from "https";

function env(name, fallback = null) {
  const v = process.env[name];
  return v === undefined || v === null || String(v).trim() === "" ? fallback : String(v).trim();
}

function getBirdAccessKey() {
  return env("BIRD_ACCESS_KEY", env("MESSAGEBIRD_ACCESS_KEY", null));
}

function getWorkspaceId() {
  return env("BIRD_SMS_WORKSPACE_ID", null);
}

function getChannelId() {
  return env("BIRD_SMS_CHANNEL_ID", null);
}

function getChannelsApiBase() {
  const base = env("BIRD_CHANNELS_API_BASE", "https://api.bird.com");
  return String(base).replace(/\/+$/, "");
}

function getLegacyApiBase() {
  const base = env("BIRD_API_BASE", "https://rest.messagebird.com");
  return String(base).replace(/\/+$/, "");
}

function getBirdOriginator() {
  return (
    env("BIRD_ORIGINATOR", null) ||
    env("MESSAGEBIRD_ORIGINATOR", null) ||
    env("BIRD_FROM", null) ||
    env("MESSAGEBIRD_FROM", null)
  );
}

function getBirdTimeoutMs() {
  const n = Number(env("BIRD_TIMEOUT_MS", "10000"));
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

function isBirdDryRun() {
  const v = String(env("BIRD_DRY_RUN", "")).toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function requestJson(url, method, headers, bodyObj, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);

    const req = https.request(
      url,
      {
        method,
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, text: data }));
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout na ${timeoutMs}ms`)));

    req.write(body);
    req.end();
  });
}

function requestForm(url, headers, formBody, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(formBody)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, text: data }));
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout na ${timeoutMs}ms`)));

    req.write(formBody);
    req.end();
  });
}

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function birdSendSmsChannels({ to, body }) {
  const accessKey = getBirdAccessKey();
  const ws = getWorkspaceId();
  const ch = getChannelId();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!ws) return { ok: false, error: "Bird niet geconfigureerd: BIRD_SMS_WORKSPACE_ID ontbreekt." };
  if (!ch) return { ok: false, error: "Bird niet geconfigureerd: BIRD_SMS_CHANNEL_ID ontbreekt." };

  const url = `${getChannelsApiBase()}/workspaces/${ws}/channels/${ch}/messages`;
  const timeoutMs = getBirdTimeoutMs();

  const payload = {
    receiver: {
      contacts: [{ identifierValue: String(to) }]
    },
    body: {
      type: "text",
      text: { text: String(body) }
    }
  };

  if (isBirdDryRun()) {
    console.log("🟡 Bird DRY RUN channels sms", { ws, ch, to, preview: String(body).slice(0, 160) });
    return { ok: true, id: null, raw: { dryRun: true, mode: "channels" } };
  }

  try {
    const resp = await requestJson(
      url,
      "POST",
      {
        Authorization: `AccessKey ${accessKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      payload,
      timeoutMs
    );

    const status = resp.status || 0;
    const rawText = resp.text || "";
    const j = safeJson(rawText);

    if (status < 200 || status >= 300) {
      const msg =
        j?.message ||
        j?.error?.message ||
        (Array.isArray(j?.errors) && j.errors[0]?.description) ||
        rawText ||
        "Onbekende fout";
      return { ok: false, error: `Bird channels error status=${status} ${msg}`, raw: j || rawText };
    }

    return { ok: true, id: j?.id ?? null, raw: j || rawText };
  } catch (e) {
    return { ok: false, error: `Bird channels request error: ${e?.message || String(e)}` };
  }
}

async function birdSendSmsLegacy({ to, body }) {
  const accessKey = getBirdAccessKey();
  const originator = getBirdOriginator();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!originator) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ORIGINATOR ontbreekt." };

  const url = `${getLegacyApiBase()}/messages`;
  const timeoutMs = getBirdTimeoutMs();

  const params = new URLSearchParams();
  params.set("recipients", String(to));
  params.set("originator", String(originator));
  params.set("body", String(body));

  if (isBirdDryRun()) {
    console.log("🟡 Bird DRY RUN legacy sms", { to, originator, preview: String(body).slice(0, 160) });
    return { ok: true, id: null, raw: { dryRun: true, mode: "legacy" } };
  }

  try {
    const resp = await requestForm(
      url,
      {
        Authorization: `AccessKey ${accessKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      params.toString(),
      timeoutMs
    );

    const status = resp.status || 0;
    const rawText = resp.text || "";
    const j = safeJson(rawText);

    if (status < 200 || status >= 300) {
      const e0 = Array.isArray(j?.errors) && j.errors.length ? j.errors[0] : null;
      const msg = e0?.description || e0?.message || j?.message || rawText || "Onbekende fout";
      return { ok: false, error: `Bird legacy error status=${status} ${msg}`, raw: j || rawText };
    }

    return { ok: true, id: j?.id ?? null, raw: j || rawText };
  } catch (e) {
    return { ok: false, error: `Bird legacy request error: ${e?.message || String(e)}` };
  }
}

// Hoofdexport die je overal gebruikt
export async function sendSms({ to, body }) {
  const ws = getWorkspaceId();
  const ch = getChannelId();

  // Als ws + ch bestaan: altijd Channels gebruiken, originator is dan niet nodig
  if (ws && ch) return birdSendSmsChannels({ to, body });

  // Anders fallback naar legacy
  return birdSendSmsLegacy({ to, body });
}

// Alias voor compatibiliteit
export async function sendBirdSms({ to, body }) {
  return sendSms({ to, body });
}
