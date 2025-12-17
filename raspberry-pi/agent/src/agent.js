// raspberry-pi/agent/src/agent.js

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startAgent({ api, hardware, config }) {
  const {
    boxId,
    pollMs = 5000,
    heartbeatMs = 10000,
    moveMs = 20000
  } = config;

  let busy = false;
  let shutterState = "CLOSED";

  // -----------------------------
  // Logging
  // -----------------------------

  function log(...args) {
    console.log(`[AGENT ${boxId}]`, ...args);
  }

  // -----------------------------
  // Status & events naar API
  // -----------------------------

  async function sendStatus(type = "heartbeat") {
    await api.sendStatus({
      shutterState,
      type,
      source: "agent"
    });
  }

  async function sendEvent(type, payload = {}) {
    await api.sendEvent({
      type,
      payload
    });
  }

  // -----------------------------
  // Shutter acties
  // -----------------------------

  async function open(commandId) {
    if (busy) {
      log("Open genegeerd, agent is bezig");
      return;
    }

    busy = true;

    try {
      shutterState = "OPENING";
      await sendEvent("shutter.opening", { commandId });
      await sendStatus("state");

      await hardware.open();
      await sleep(moveMs);

      shutterState = "OPEN";
      await sendEvent("shutter.opened", { commandId });
      await sendStatus("state");

      if (commandId) {
        await api.ackCommand(commandId, true);
      }
    } catch (err) {
      log("Fout bij openen", err.message);

      if (commandId) {
        await api.ackCommand(commandId, false, "open_failed", err.message);
      }
    } finally {
      busy = false;
    }
  }

  async function close(commandId) {
    if (busy) {
      log("Close genegeerd, agent is bezig");
      return;
    }

    busy = true;

    try {
      shutterState = "CLOSING";
      await sendEvent("shutter.closing", { commandId });
      await sendStatus("state");

      await hardware.close();
      await sleep(moveMs);

      shutterState = "CLOSED";
      await sendEvent("shutter.closed", { commandId });
      await sendStatus("state");

      if (commandId) {
        await api.ackCommand(commandId, true);
      }
    } catch (err) {
      log("Fout bij sluiten", err.message);

      if (commandId) {
        await api.ackCommand(commandId, false, "close_failed", err.message);
      }
    } finally {
      busy = false;
    }
  }

  // -----------------------------
  // Command polling
  // -----------------------------

  async function commandLoop() {
    while (true) {
      try {
        const cmd = await api.fetchNextCommand();

        if (!cmd) {
          await sleep(pollMs);
          continue;
        }

        log("Command ontvangen", cmd.type, cmd.id);

        if (cmd.type === "open") {
          await open(cmd.id);
        }

        if (cmd.type === "close") {
          await close(cmd.id);
        }
      } catch (err) {
        log("Command loop fout", err.message);
        await sleep(pollMs);
      }
    }
  }

  // -----------------------------
  // Heartbeat
  // -----------------------------

  async function heartbeatLoop() {
    while (true) {
      try {
        await sendStatus("heartbeat");
      } catch (err) {
        log("Heartbeat fout", err.message);
      }

      await sleep(heartbeatMs);
    }
  }

  // -----------------------------
  // Start agent
  // -----------------------------

  (async () => {
    log("Agent gestart");
    await sendEvent("device.agent.started", { boxId });
    await sendStatus("startup");

    heartbeatLoop();
    commandLoop();
  })();
}
