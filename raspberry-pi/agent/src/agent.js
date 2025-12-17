// raspberry-pi/agent/src/agent.js
// Gridbox Raspberry Pi Agent – hardware-agnostisch
// Gebruikt door simulator én echte Raspberry Pi

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent({ api, hardware, config }) {
  const {
    pollMs = 5000,
    heartbeatMs = 10000,
    moveMs = 20000,
    boxId
  } = config;

  let busy = false;
  let shutterState = "CLOSED";

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  function log(...args) {
    console.log(`[AGENT ${boxId}]`, ...args);
  }

  // --------------------------------------------------
  // Status & Events
  // --------------------------------------------------

  async function sendStatus(type = "heartbeat") {
    await api.sendStatus({
      shutterState,
      type
    });
  }

  async function sendEvent(type, payload = {}) {
    await api.sendEvent({
      type,
      payload
    });
  }

  // --------------------------------------------------
  // Open / Close
  // --------------------------------------------------

  async function open(commandId) {
    if (busy) {
      log("open genegeerd – agent is bezig");
      return;
    }

    busy = true;

    try {
      log("OPEN gestart");
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

      log("OPEN klaar");
    } catch (err) {
      log("OPEN fout:", err.message);

      if (commandId) {
        await api.ackCommand(commandId, false, "open_failed", err.message);
      }
    } finally {
      busy = false;
    }
  }

  async function close(commandId) {
    if (busy) {
      log("close genegeerd – agent is bezig");
      return;
    }

    busy = true;

    try {
      log("CLOSE gestart");
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

      log("CLOSE klaar");
    } catch (err) {
      log("CLOSE fout:", err.message);

      if (commandId) {
        await api.ackCommand(commandId, false, "close_failed", err.message);
      }
    } finally {
      busy = false;
    }
  }

  // --------------------------------------------------
  // Command polling
  // --------------------------------------------------

  async function commandLoop() {
    while (true) {
      try {
        const cmd = await api.fetchNextCommand();

        if (cmd && cmd.type) {
          log("Command ontvangen:", cmd.type, cmd.id);

          if (cmd.type === "open") await open(cmd.id);
          else if (cmd.type === "close") await close(cmd.id);
          else log("Onbekend command type:", cmd.type);
        }
      } catch (err) {
        log("commandLoop fout:", err.message);
      }

      await sleep(pollMs);
    }
  }

  // --------------------------------------------------
  // Heartbeat
  // --------------------------------------------------

  async function heartbeatLoop() {
    while (true) {
      try {
        await sendStatus("heartbeat");
      } catch (err) {
        log("heartbeat fout:", err.message);
      }

      await sleep(heartbeatMs);
    }
  }

  // --------------------------------------------------
  // Start
  // --------------------------------------------------

  (async () => {
    log("Agent gestart");
    await sendEvent("device.agent.started", { boxId });
    await sendStatus("startup");

    heartbeatLoop();
    commandLoop();
  })();
}
