// api/src/services/birdSmsService.js
//
// Centrale SMS service via Bird (MessageBird legacy SMS API)
// Endpoint: https://rest.messagebird.com/messages
//
// Vereiste env vars
// - BIRD_ACCESS_KEY
// - BIRD_ORIGINATOR
//
// Optioneel
// - BIRD_API_BASE     (default https://rest.messagebird.com)
// - BIRD_TIMEOUT_MS   (default 10000)
// - BIRD_DRY_RUN      ("1" of "true" om niet te versturen)

import https from "https";

function getBirdAccessKey() {
  return process.env.BIRD_ACCESS_KEY || process.env.MESSAGEBIRD_ACCESS_KEY || null;
}

function getBirdOriginator() {
  return (
    process.env.BIRD_ORIGINATOR ||
    process.env.MESSAGEBIRD_ORIGINATOR ||
    process.env.BIRD_FROM ||
    process.env.MESSAGEBIRD_FROM ||
    null
  );
}

function getBirdApiBase() {
  const base = process.env.BIRD_API_BASE || "https://rest.messagebird.com";
  return String(base).replace(/\/+$/, "");
}

function getBirdTimeoutMs() {
  const n = Number(process.env.BIRD_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

function isBirdDryRun() {
  const v = String(process.env.BIRD_DRY_RUN || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function postForm(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout na ${timeoutMs}ms`));
    });

    req.write(body);
    req.end();
  });
}

async function birdSendSmsLegacy({ to, body }) {
  const accessKey = getBirdAccessKey();
  const originator = getBirdOriginator();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!originator) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ORIGINATOR ontbreekt." };

  const url = `${getBirdApiBase()}/messages`;

  const params = new URLSearchParams();
  params.set("recipients", String(to));
  params.set("originator", String(originator));
  params.set("body", String(body));

  if (isBirdDryRun()) {
    console.log("🟡 Bird DRY RUN sms", { to, originator, body: String(body).slice(0, 160) });
    return { ok: true, id: null, raw: { dryRun: true } };
  }

  const timeoutMs = getBirdTimeoutMs();

  try {
    const resp = await postForm(
      url,
      {
        Authorization: `AccessKey ${accessKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      params.toString(),
      timeoutMs
    );

    const rawText = resp.text || "";
    const status = resp.status || 0;

    if (status < 200 || status >= 300) {
      try {
        const j = rawText ? JSON.parse(rawText) : null;
        const e0 = Array.isArray(j?.errors) && j.errors.length ? j.errors[0] : null;
        const msg = e0?.description || e0?.message || rawText || "Onbekende fout";
        return { ok: false, error: `Bird error status=${status} ${msg}` };
      } catch {
        return { ok: false, error: `Bird error status=${status} ${rawText || "Onbekende fout"}` };
      }
    }

    try {
      const data = rawText ? JSON.parse(rawText) : null;
      return { ok: true, id: data?.id ?? null, raw: data };
    } catch {
      return { ok: true, id: null, raw: rawText };
    }
  } catch (e) {
    return { ok: false, error: `Bird request error: ${e?.message || String(e)}` };
  }
}

// Hoofdexport die je overal gebruikt
export async function sendSms({ to, body }) {
  return birdSendSmsLegacy({ to, body });
}

// Alias zodat andere bestanden ook kunnen werken
export async function sendBirdSms({ to, body }) {
  return sendSms({ to, body });
}
