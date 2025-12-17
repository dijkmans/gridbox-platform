// raspberry-pi/agent/src/agent.js

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent({ api, config }) {
  const { boxId, heartbeatMs = 10000 } = config;

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

  (async () => {
    log("Agent gestart (heartbeat-only)");
    await sendHeartbeat();

    while (true) {
      await sleep(heartbeatMs);
      await sendHeartbeat();
    }
  })();
}
