// api/src/services/birdSmsService.js

function pickAccessKey() {
  return process.env.BIRD_ACCESS_KEY || process.env.MESSAGEBIRD_ACCESS_KEY || null;
}

function pickOriginator() {
  return (
    process.env.BIRD_ORIGINATOR ||
    process.env.MESSAGEBIRD_ORIGINATOR ||
    process.env.BIRD_FROM ||
    process.env.MESSAGEBIRD_FROM ||
    null
  );
}

function pickApiBase() {
  const base = process.env.BIRD_API_BASE || "https://rest.messagebird.com";
  return String(base).replace(/\/+$/, "");
}

async function readErrorBody(resp) {
  const status = resp?.status;
  const statusText = resp?.statusText;

  let text = "";
  try {
    text = await resp.text();
  } catch {
    text = "";
  }

  if (!text) return `Bird error status=${status} ${statusText}`;

  try {
    const j = JSON.parse(text);
    if (Array.isArray(j?.errors) && j.errors.length > 0) {
      const e0 = j.errors[0];
      const msg = e0?.description || e0?.message || JSON.stringify(e0);
      return `Bird error status=${status} ${msg}`;
    }
    return `Bird error status=${status} ${JSON.stringify(j)}`;
  } catch {
    return `Bird error status=${status} ${text}`;
  }
}

export async function sendBirdSms({ to, body, originator } = {}) {
  const accessKey = pickAccessKey();
  const from = originator || pickOriginator();

  if (!accessKey) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ACCESS_KEY ontbreekt." };
  if (!from) return { ok: false, error: "Bird niet geconfigureerd: BIRD_ORIGINATOR ontbreekt." };
  if (!to) return { ok: false, error: "Bird sms error: ontvanger ontbreekt." };
  if (!body) return { ok: false, error: "Bird sms error: berichttekst ontbreekt." };

  const apiBase = pickApiBase();
  const url = `${apiBase}/messages`;

  const params = new URLSearchParams();
  params.set("recipients", String(to));
  params.set("originator", String(from));
  params.set("body", String(body));

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${accessKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
  } catch (e) {
    return { ok: false, error: `Bird fetch error: ${e?.message || String(e)}` };
  }

  if (!resp.ok) {
    const err = await readErrorBody(resp);
    return { ok: false, error: err };
  }

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  return { ok: true, id: data?.id ?? null, raw: data };
}
