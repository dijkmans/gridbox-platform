// raspberry-pi/agent/src/agent.js

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent({
  api,
  hardware,
  config
}) {
  const {
    pollMs = 5000,
    heartbeatMs = 10000,
    moveMs = 20000,
    boxId
  } = config;

  let busy = false;
  let shutterState = "CLOSED";

  // -----------------------------
  // STATUS & EVENTS
  // -----------------------------

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

  // -----------------------------
  // OPEN / CLOSE
  // -----------------------------

  async function open(commandId) {
    if (busy) return;
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

      if (commandId) await api.ackCommand(commandId, true);
    } catch (err) {
      if (commandId) await api.ackCommand(commandId, false, "open_failed", err.message);
    } finally {
      busy = false;
    }
  }

  async function close(commandId) {
    if (busy) return;
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

      if (commandId) await api.ackCommand(commandId, true);
    } catch (err) {
      if (commandId) await api.ackCommand(commandId, false, "close_failed", err.message);
    } finally {
      busy = false;
    }
  }

  // -----------------------------
  // COMMAND LOOP
  // -----------------------------

  async function commandLoop() {
    while (true) {
      try {
        const cmd = await api.fetchNextCommand();
        if (cmd) {
          if (cmd.type === "open") await open(cmd.id);
          if (cmd.type === "close") await close(cmd.id);
        }
      } catch (err) {
        console.error("command loop error", err.message);
      }
      await sleep(pollMs);
    }
  }

  // -----------------------------
  // HEARTBEAT
  // -----------------------------

  async function heartbeatLoop() {
    while (true) {
      try {
        await sendStatus("heartbeat");
      } catch {}
      await sleep(heartbeatMs);
    }
  }

  // -----------------------------
  // START
  // -----------------------------

  (async () => {
    console.log("Gridbox agent gestart voor box", boxId);
    await sendEvent("device.agent.started", { boxId });
    await sendStatus("startup");
    heartbeatLoop();
    commandLoop();
  })();
}
