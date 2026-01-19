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
//   Tip: neem exact de waarde uit de Bird URL na "/channels/"
//   Voorbeeld uit je Bird URL: "sms-messagebird:1/3201ff4e-7614-4159-8333-a9b14acded85"
// - BIRD_CHANNEL_SENDER of BIRD_ORIGINATOR
//   Dit is je "from" nummer, bv "+32480214031"
// - Optioneel: BIRD_CONTACT_IDENTIFIER_KEY (default "phonenumber")
//
// Vereiste env vars (Legacy fallback)
// - BIRD_ACCESS_KEY
// - BIRD_ORIGINATOR
//
// Optioneel
// - BIRD_CHANNELS_API_BASE  (default https://api.bird.com)
// - BIRD_API_BASE           (default https://rest.messagebird.com)
// - BIRD_TIMEOUT_MS         (default 10000)
// - BIRD_DRY_RUN            ("1" of "true")

import https from "https";

function env(name, fallback = null) {
  const v = process.env[name];
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
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

function getContactIdentifierKey() {
  return env("BIRD_CONTACT_IDENTIFIER_KEY", "phonenumber");
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

// Voor Channels gebruiken we liefst een aparte var, maar we vallen terug op BIRD_ORIGINATOR
function getChannelsSender() {
  return env("BIRD_CHANNEL_SENDER", getBirdOriginator());
}

function getBirdTimeoutMs() {
  const n = Number(env("BIRD_TIMEOUT_MS", "10000"));
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

function isBirdDryRun() {
  const v = String(env("BIRD_DRY_RUN", "")).toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function maskPhone(p) {
  const s = String(p || "");
  if (s.length < 6) return s;
  return s.slice(0, 4) + "..." + s.slice(-2);
}

/* =========================
   HTTP helpers met redirect support
   ========================= */

function requestWithRedirect(url, options, bodyString, timeoutMs, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const status = res.statusCode || 0;
      const location = res.headers && res.headers.location ? String(res.headers.location) : "";

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", async () => {
        const isRedirect = [301, 302, 303, 307, 308].includes(status) && location;

        if (isRedirect && redirectsLeft > 0) {
          try {
            const nextUrl = new URL(location, url).toString();

            let nextOptions = { ...options };
            let nextBody = bodyString || "";

            // 303: switch meestal naar GET zonder body
            if (status === 303) {
              nextOptions = { ...nextOptions, method: "GET" };
              nextBody = "";

              if (nextOptions.headers) {
                const h = { ...nextOptions.headers };
                delete h["Content-Length"];
                delete h["Content-Type"];
                nextOptions.headers = h;
              }
            }

            // Content-Length opnieuw zetten als er body is
            if (nextBody && nextOptions.headers) {
              nextOptions.headers = {
                ...nextOptions.headers,
                "Content-Length": Buffer.byteLength(nextBody)
              };
            } else if (!nextBody && nextOptions.headers) {
              const h = { ...nextOptions.headers };
              delete h["Content-Length"];
              nextOptions.headers = h;
            }

            const resp2 = await requestWithRedirect(nextUrl, nextOptions, nextBody, timeoutMs, redirectsLeft - 1);
            return resolve(resp2);
          } catch (e) {
            return resolve({ status, text: data || "" });
          }
        }

        return resolve({ status, text: data || "" });
      });
    });

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout na ${timeoutMs}ms`)));

    if (bodyString) req.write(bodyString);
    req.end();
  });
}

function requestJson(url, method, headers, bodyObj, timeoutMs) {
  const body = JSON.stringify(bodyObj);

  const options = {
    method,
    headers: {
      ...headers,
      "Content-Length": Buffer.byteLength(body)
    }
  };

  return requestWithRedirect(url, options, body, timeoutMs);
}

function requestForm(url, headers, formBody, timeoutMs) {
  const options = {
    method: "POST",
    headers: {
      ...headers,
      "Content-Length": Buffer.byteLength(formBody)
    }
  };

  return requestWithRedirect(url, options, formBody, timeoutMs);
}

/* =========================
   Channels (app.bird.com)
   ========================= */

function buildChannelsUrl(ws, ch) {
  // channelId kan een "/" bevatten (bv sms-messagebird:1/<uuid>)
  // Daarom moet het als 1 path-segment ge-encode worden.
  const chEnc = encodeURIComponent(String(ch));
  return `${getChannelsApiBase()}/workspaces/${ws}/channels/${chEnc}/messages`;
}

function extractChannelsErrorMessage(status, rawText) {
  const j = safeJson(rawText);

  // Veel voorkomende shapes:
  // - { message: "..." }
  // - { error: { message: "..." } }
  // - { errors: [ { description, message, parameter } ] }
  const msg =
    j?.message ||
    j?.error?.message ||
    (Array.isArray(j?.errors) && (j.errors[0]?.description || j.errors[0]?.message)) ||
    rawText ||
    "Onbekende fout";

  return { msg, json: j };
}

async function birdSendSmsChannels({ to, body }) {
  const accessKey = getBirdAccessKey();
  const ws = getWorkspaceId();
  const ch = getChannelId();
  const sender = getChannelsSender();
  const identifierKey = getContactIdentifierKey();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!ws) return { ok: false, error: "Bird niet geconfigureerd: BIRD_SMS_WORKSPACE_ID ontbreekt." };
  if (!ch) return { ok: false, error: "Bird niet geconfigureerd: BIRD_SMS_CHANNEL_ID ontbreekt." };

  if (!sender) return { ok: false, error: "Bird niet geconfigureerd: BIRD_CHANNEL_SENDER of BIRD_ORIGINATOR ontbreekt." };

  const url = buildChannelsUrl(ws, ch);
  const timeoutMs = getBirdTimeoutMs();

  const payload = {
    sender: {
      connector: {
        identifierKey,
        identifierValue: String(sender)
      }
    },
    receiver: {
      contacts: [
        {
          identifierKey,
          identifierValue: String(to)
        }
      ]
    },
    body: {
      type: "text",
      text: {
        text: String(body)
      }
    }
  };

  if (isBirdDryRun()) {
    console.log(
      "🟡 Bird DRY RUN channels sms " +
        JSON.stringify(
          {
            ws,
            ch,
            sender: maskPhone(sender),
            to: maskPhone(to),
            preview: String(body).slice(0, 160)
          },
          null,
          0
        )
    );
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

    if (status < 200 || status >= 300) {
      const { msg, json } = extractChannelsErrorMessage(status, rawText);

      console.error(
        "⚠️ Bird channels error " +
          JSON.stringify(
            {
              status,
              ws,
              ch,
              sender: maskPhone(sender),
              to: maskPhone(to),
              msg,
              raw: json || rawText
            },
            null,
            0
          )
      );

      return { ok: false, error: `Bird channels error status=${status} ${msg}`, raw: json || rawText };
    }

    const j = safeJson(rawText);
    return { ok: true, id: j?.id ?? null, raw: j || rawText };
  } catch (e) {
    return { ok: false, error: `Bird channels request error: ${e?.message || String(e)}` };
  }
}

/* =========================
   Legacy (rest.messagebird.com)
   ========================= */

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
    console.log(
      "🟡 Bird DRY RUN legacy sms " +
        JSON.stringify(
          { to: maskPhone(to), originator: maskPhone(originator), preview: String(body).slice(0, 160) },
          null,
          0
        )
    );
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

      console.error(
        "⚠️ Bird legacy error " +
          JSON.stringify(
            {
              status,
              to: maskPhone(to),
              originator: maskPhone(originator),
              msg,
              raw: j || rawText
            },
            null,
            0
          )
      );

      return { ok: false, error: `Bird legacy error status=${status} ${msg}`, raw: j || rawText };
    }

    return { ok: true, id: j?.id ?? null, raw: j || rawText };
  } catch (e) {
    return { ok: false, error: `Bird legacy request error: ${e?.message || String(e)}` };
  }
}

/* =========================
   Public API
   ========================= */

export async function sendSms({ to, body }) {
  const ws = getWorkspaceId();
  const ch = getChannelId();

  if (ws && ch) return birdSendSmsChannels({ to, body });
  return birdSendSmsLegacy({ to, body });
}

export async function sendBirdSms({ to, body }) {
  return sendSms({ to, body });
}
