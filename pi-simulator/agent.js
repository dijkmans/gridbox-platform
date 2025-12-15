import fetch from "node-fetch";
import { CONFIG } from "./config.js";

const { boxId, apiBaseUrl, statusIntervalSeconds } = CONFIG;

// Lokale state zodat heartbeat niet alles terug "closed" maakt
let doorState = "closed";
let lockState = "locked";

/**
 * Config ophalen
 */
async function fetchConfig() {
  const res = await fetch(`${apiBaseUrl}/devices/${boxId}/config`);
  if (!res.ok) throw new Error("Config ophalen mislukt");
  return res.json();
}

/**
 * Status versturen
 */
async function sendStatus(extra = {}) {
  const status = {
    online: true,
    door: doorState,
    lock: lockState,
    simulated: true,
    timestamp: new Date().toISOString(),
    ...extra
  };

  await fetch(`${apiBaseUrl}/devices/${boxId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status)
  });
}

/**
 * Event versturen
 */
async function sendEvent(type, payload = {}) {
  await fetch(`${apiBaseUrl}/devices/${boxId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
      source: "pi-simulator"
    })
  });
}

/**
 * Pending commands ophalen
 */
async function fetchPendingCommands() {
  try {
    const res = await fetch(`${apiBaseUrl}/devices/${boxId}/commands/pending`);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.commands)) return [];
    return data.commands;
  } catch (err) {
    console.error("❌ Fout bij ophalen commands:", err.message);
    return [];
  }
}

/**
 * Command markeren als done
 */
async function markCommandDone(commandId, result = "ok", extra = {}) {
  try {
    await fetch(`${apiBaseUrl}/devices/${boxId}/commands/${commandId}/done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        result,
        ...extra
      })
    });
  } catch (err) {
    console.error("❌ Fout bij afronden command:", err.message);
  }
}

/**
 * Command uitvoeren (simulatie)
 */
async function executeCommand(command) {
  const rawType = (command?.type ?? "").toString().trim();
  const type = rawType.toLowerCase();

  console.log("⚙️ Command ontvangen:", rawType || "(geen type)");

  if (type === "open") {
    console.log("🔓 Simulatie: box openen");

    doorState = "open";
    lockState = "unlocked";

    await sendStatus();
    await markCommandDone(command.id, "ok");

    console.log("✅ OPEN afgerond");
    return;
  }

  if (type === "close") {
    console.log("🔒 Simulatie: box sluiten");

    doorState = "closed";
    lockState = "locked";

    await sendStatus();
    await markCommandDone(command.id, "ok");

    console.log("✅ CLOSE afgerond");
    return;
  }

  console.log("⚠️ Onbekend command type:", rawType);
  await markCommandDone(command.id, "unknown_command", {
    payload: { receivedType: rawType }
  });
}

/**
 * Hoofdprogramma
 */
async function boot() {
  console.log("🟢 Gridbox Pi-simulator gestart");
  console.log("Box ID:", boxId);

  const config = await fetchConfig();
  console.log("📥 Config ontvangen:", config);

  await sendEvent("boot", { version: "pi-simulator-1.1" });

  // Heartbeat
  setInterval(async () => {
    await sendStatus();
    console.log("📡 Heartbeat status verzonden:", doorState, lockState);
  }, statusIntervalSeconds * 1000);

  // Command polling
  setInterval(async () => {
    const commands = await fetchPendingCommands();
    for (const command of commands) {
      await executeCommand(command);
    }
  }, 5000);
}

boot().catch(err => {
  console.error("❌ Simulator fout:", err.message);
});
