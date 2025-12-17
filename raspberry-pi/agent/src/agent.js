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

  // -------------------------------------------------
  // Logging
  // -------------------------------------------------

  function log(...args) {
    console.log(`[AGENT ${boxId}]`, ...args);
  }

  // -------------------------------------------------
  // API helpers
  // -------------------------------------------------

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

  // -------------------------------------------------
  // Shutter control
  // -------------------------------------------------

  async function open(commandId = null, source = "api") {
    if (busy) {
      log("OPEN genegeerd, agent bezig");
      return;
    }

    busy = true;

    try {
      shutterState = "OPENING";
      log("Rolluik openen", source);
      await sendEvent("shutter.opening", { commandId, source });
      await sendStatus("state");

      await hardware.open();
      await sleep(moveMs);

      shutterState = "OPEN";
      await sendEvent("shutter.opened", { commandId, source });
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

  async function close(commandId = null, source = "api") {
    if (busy) {
      log("CLOSE genegeerd, agent bezig");
      return;
    }

    busy = true;

    try {
      shutterState = "CLOSING";
      log("Rolluik sluiten", source);
      await sendEvent("shutter.closing", { commandId, source });
      await sendStatus("state");

      await hardware.close();
      await sleep(moveMs);

      shutterState = "CLOSED";
      await sendEvent("shutter.closed", { commandId, source });
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

  // -------------------------------------------------
  // Fysieke knop (optioneel)
  // -------------------------------------------------

  if (hardware.onButtonPress) {
    hardware.onButtonPress(async () => {
      log("Fysieke knop ingedrukt");

      if (shutterState === "OPEN") {
        await close(null, "button");
      } else if (shutterState === "CLOSED") {
        await open(null, "button");
      }
    });
  }

  // -------------------------------------------------
  // Command polling
  // -------------------------------------------------

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
          await open(cmd.id, "api");
        }

        if (cmd.type === "close") {
          await close(cmd.id, "api");
        }
      } catch (err) {
        log("Command loop fout", err.message);
        await sleep(pollMs);
      }
    }
  }

  // -------------------------------------------------
  // Heartbeat
  // -------------------------------------------------

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

  // -------------------------------------------------
  // Start agent
  // -------------------------------------------------

  (async () => {
    log("Agent gestart");
    await sendEvent("device.agent.started", { boxId });
    await sendStatus("startup");

    heartbeatLoop();
    commandLoop();
  })();
}
