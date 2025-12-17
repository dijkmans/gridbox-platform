// raspberry-pi/agent/src/agent.js

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

      // Voorlopig: alleen bevestigen, geen uitvoering
      await api.sendStatus({
        type: "command-received",
        commandId: cmd.id,
        commandType: cmd.type,
        source: "agent"
      });
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
