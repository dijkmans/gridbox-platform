// api/src/utils/birdSms.js
//
// Bird SMS sender via Channels API
// Vereist env vars:
// - BIRD_ACCESS_KEY
// - BIRD_SMS_WORKSPACE_ID
// - BIRD_SMS_CHANNEL_ID
// - BIRD_SMS_SENDER        (bv. +32480214031)

function reqEnv(name) {
  const v = process.env[name];
  return (v && String(v).trim()) ? String(v).trim() : null;
}

export async function sendBirdSms(toE164, text) {
  const accessKey = reqEnv("BIRD_ACCESS_KEY");
  const workspaceId = reqEnv("BIRD_SMS_WORKSPACE_ID");
  const channelId = reqEnv("BIRD_SMS_CHANNEL_ID");
  const senderNumber = reqEnv("BIRD_SMS_SENDER");

  if (!accessKey || !workspaceId || !channelId || !senderNumber) {
    return {
      ok: false,
      error: "Bird niet geconfigureerd: zet BIRD_ACCESS_KEY, BIRD_SMS_WORKSPACE_ID, BIRD_SMS_CHANNEL_ID, BIRD_SMS_SENDER"
    };
  }

  const url = `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`;

  const payload = {
    receiver: {
      contacts: [
        {
          identifiers: [
            { identifierKey: "phonenumber", identifierValue: toE164 }
          ]
        }
      ]
    },
    sender: {
      connector: { identifierValue: senderNumber }
    },
    body: {
      type: "text",
      text: { text }
    }
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `AccessKey ${accessKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    let json = null;
    try { json = raw ? JSON.parse(raw) : null; } catch {}

    if (!r.ok) {
      return {
        ok: false,
        error: `Bird send failed: HTTP ${r.status}`,
        details: json ?? raw
      };
    }

    return { ok: true, result: json ?? raw };
  } catch (e) {
    return { ok: false, error: `Bird send exception: ${e?.message ?? String(e)}` };
  }
}
