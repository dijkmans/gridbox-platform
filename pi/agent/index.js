import { loadConfig } from "./config.js";
import { initApi, sendStatus, sendEvent, fetchPendingCommands, ackCommand } from "./api.js";
import { initGPIO, openRolluik, closeRolluik } from "./gpio.js";
import { initRFID } from "./rfid.js";
import { initCamera, takePhoto } from "./camera.js";
import { startTunnel } from "./autossh.js";
import { log } from "./logger.js";

const config = loadConfig();

log("Gridbox agent start");

await initApi(config);
await initGPIO(config);
await initRFID(config);
await initCamera(config);
startTunnel(config);

const executing = new Set();

async function safeSendStatus(payload) {
  try {
    await sendStatus(payload);
  } catch (err) {
    log("Status sturen mislukt: " + err.message);
  }
}

async function safeSendEvent(type, meta = {}) {
  try {
    await sendEvent(type, meta);
  } catch (err) {
    log("Event sturen mislukt: " + err.message);
  }
}

async function safeAck(commandId, result) {
  try {
    await ackCommand(commandId, result);
  } catch (err) {
    log("ACK mislukt: " + err.message);
  }
}

async function executeCommand(command) {
  const id = command.id;
  const type = String(command.type || "").toUpperCase();

  if (!id) return;
  if (executing.has(id)) return;
  executing.add(id);

  try {
    log(`Command ontvangen: ${type} (${id})`);

    if (type === "OPEN") {
      // Optioneel: foto bij open
      if (config.cameraEnabled) {
        takePhoto();
      }

      openRolluik();

      await safeSendStatus({
        online: true,
        uptime: Math.floor(process.uptime()),
        door: "open",
        lock: "unlocked",
        lastCommandId: id,
        lastCommandType: type
      });

      await safeAck(id, "ok");
      await safeSendEvent("OPEN_OK", { commandId: id });
      return;
    }

    if (type === "CLOSE") {
      // Optioneel: foto bij dicht
      if (config.cameraEnabled) {
        takePhoto();
      }

      closeRolluik();

      await safeSendStatus({
        online: true,
        uptime: Math.floor(process.uptime()),
        door: "closed",
        lock: "locked",
        lastCommandId: id,
        lastCommandType: type
      });

      await safeAck(id, "ok");
      await safeSendEvent("CLOSE_OK", { commandId: id });
      return;
    }

    log("Onbekend command type: " + type);
    await safeAck(id, "ignored");
    await safeSendEvent("COMMAND_IGNORED", { commandId: id, type });
  } catch (err) {
    log("Command fout: " + err.message);
    await safeAck(id, "error:" + err.message);
    await safeSendEvent("COMMAND_ERROR", { commandId: id, error: err.message });
  } finally {
    executing.delete(id);
  }
}

// Heartbeat
setInterval(() => {
  safeSendStatus({
    online: true,
    uptime: Math.floor(process.uptime())
  });
}, 30000);

// Commands poll
setInterval(async () => {
  try {
    const commands = await fetchPendingCommands();
    if (!commands || commands.length === 0) return;

    for (const cmd of commands) {
      await executeCommand(cmd);
    }
  } catch (err) {
    log("Commands ophalen mislukt: " + err.message);
  }
}, 2000);

// Keep-alive log
setInterval(() => {
  log("agent alive");
}, 30000);

await safeSendEvent("PI_READY", {
  boxId: config.boxId,
  cameraEnabled: !!config.cameraEnabled,
  relayPin: config.relayPin
});
