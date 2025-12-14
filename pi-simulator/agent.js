import fetch from "node-fetch";
import { CONFIG } from "./config.js";

const { boxId, apiBaseUrl, statusIntervalSeconds } = CONFIG;

async function fetchConfig() {
  const res = await fetch(`${apiBaseUrl}/devices/${boxId}/config`);
  if (!res.ok) {
    throw new Error("Config ophalen mislukt");
  }
  return res.json();
}

async function sendStatus(status) {
  await fetch(`${apiBaseUrl}/devices/${boxId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status)
  });
}

async function sendEvent(type, payload = {}) {
  await fetch(`${apiBaseUrl}/devices/${boxId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString()
    })
  });
}

async function boot() {
  console.log("🟢 Gridbox Pi-simulator gestart");
  console.log("Box ID:", boxId);

  const config = await fetchConfig();
  console.log("📥 Config ontvangen:", config);

  await sendEvent("boot", { version: "pi-simulator-1.0" });

  setInterval(async () => {
    const status = {
      online: true,
      door: "closed",
      lock: "locked",
      simulated: true,
      timestamp: new Date().toISOString()
    };

    await sendStatus(status);
    console.log("📡 Status verzonden");
  }, statusIntervalSeconds * 1000);
}

boot().catch(err => {
  console.error("❌ Simulator fout:", err.message);
});
