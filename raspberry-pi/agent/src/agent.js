// raspberry-pi/agent/src/agent.js

import { createHardwareStub } from "./hardwareStub.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent({ api, config }) {
  const {
    boxId,
    heartbeatMs = 10000,
    commandPollMs = 3000
  } = config;

  function log(...args) {
    console.log(`[AGENT ${boxId}]`, ...args);
  }

  // Hardware (stub)
  const hardware = createHardwareStub({ boxId });

  async function sendHeartbeat() {
    await api.sendStatus({
      shutterState: "CLOSED",
      type: "heartbeat",
      source: "agent"
    });
  }

  async function pollCommands() {
    try {
      const cmd = await api.getNextCommand();

      if (!cmd) return;

      log("Command ontvangen:", cmd);

      // 1. Status: command ontvangen
      await api.sendStatus({
        type: "command-received",
        commandId: cmd.id,
        commandType: cmd.type,
        source: "agent"
      });

      // 2. Command onmiddellijk bevestigen
      await api.ackCommand(cmd.id, "received");
      log("Command bevestigd:", cmd.id);

      // 3. Hardware simulatie
      if (cmd.type === "open") {
        await hardware.openShutter();

        await api.sendStatus({
          type: "command-done",
          commandId: cmd.id,
          result: "open",
          source: "agent"
        });
      }

      if (cmd.type === "close") {
        await hardware.closeShutter();

        await api.sendStatus({
          type: "command-done",
          commandId: cmd.id,
          result: "close",
          source: "agent"
        });
      }

    } catch (err) {
      log("Fout bij command polling:", err.message);
    }
  }

  // Heartbeat loop
  (async () => {
    log("Agent gestart");
    await sendHeartbeat();

    while (true) {
      await sleep(heartbeatMs);
      await sendHeartbeat();
    }
  })();

  // Command polling loop
  (async () => {
    while (true) {
      await sleep(commandPollMs);
      await pollCommands();
    }
  })();
}
