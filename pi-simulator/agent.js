import fetch from "node-fetch";
import { CONFIG } from "./config.js";

const { boxId, apiBaseUrl, statusIntervalSeconds } = CONFIG;

function url(path) {
  const base = String(apiBaseUrl).replace(/\/$/, "");
  return `${base}${path}`;
}

async function fetchConfig() {
  const res = await fetch(url(`/devices/${boxId}/config`));
  if (!res.ok) throw new Error("Config ophalen mislukt");
  return res.json();
}

async function sendStatus(status) {
  await fetch(url(`/status/${boxId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status)
  });
}

async function sendEvent(type, meta = {}) {
  await fetch(url(`/events/${boxId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, source: "pi-simulator", meta })
  });
}

async function fetchPendingCommands() {
  try {
    const res = await fetch(url(`/commands/${boxId}`));
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.commands)) return [];
    return data.commands;
  } catch (err) {
    console.error("❌ Fout bij ophalen commands:", err.message);
    return [];
  }
}

async function ackCommand(commandId, result = "ok") {
  await fetch(url(`/commands/${boxId}/ack`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId, result })
  });
}

async function executeCommand(command) {
  const type = String(command.type || "").toUpperCase();
  console.log("⚙️ Command ontvangen:", type, command.id);

  if (type === "OPEN") {
    console.log("🔓 Simulatie: box openen");

    await sendStatus({
      online: true,
      door: "open",
      lock: "unlocked",
      simulated: true,
      uptime: Math.floor(process.uptime())
    });

    await ackCommand(command.id, "ok");
    await sendEvent("OPEN_OK", { commandId: command.id });
    console.log("✅ OPEN afgerond");
    return;
  }

  if (type === "CLOSE") {
    console.log("🔒 Simulatie: box sluiten");

    await sendStatus({
      online: true,
      door: "closed",
      lock: "locked",
      simulated: true,
      uptime: Math.floor(process.uptime())
    });

    await ackCommand(command.id, "ok");
    await sendEvent("CLOSE_OK", { commandId: command.id });
    console.log("✅ CLOSE afgerond");
    return;
  }

  console.log("⚠️ Onbekend command:", type);
  await ackCommand(command.id, "ignored");
  await sendEvent("COMMAND_IGNORED", { commandId: command.id, type });
}

async function boot() {
  console.log("🟢 Gridbox Pi-simulator gestart");
  console.log("Box ID:", boxId);

  const config = await fetchConfig();
  console.log("📥 Config ontvangen:", config);

  await sendEvent("PI_SIM_BOOT", { version: "pi-simulator-1.1" });

  // Heartbeat
  setInterval(async () => {
    try {
      await sendStatus({
        online: true,
        simulated: true,
        uptime: Math.floor(process.uptime())
      });
      console.log("📡 Status verzonden");
    } catch (err) {
      console.error("❌ Status fout:", err.message);
    }
  }, statusIntervalSeconds * 1000);

  // Commands poll
  setInterval(async () => {
    const commands = await fetchPendingCommands();
    for (const command of commands) {
      await executeCommand(command);
    }
  }, 2000);
}

boot().catch((err) => {
  console.error("❌ Simulator fout:", err.message);
});
