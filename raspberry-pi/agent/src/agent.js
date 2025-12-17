// raspberry-pi/agent/src/agent.js

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent({ api, hardware, config }) {
  const {
    boxId,
    pollMs = 5000,
    heartbeatMs = 10000
  } = config;

  let shutterState = "CLOSED";

  function log(...args) {
    console.log(`[AGENT ${boxId}]`, ...args);
  }

  async function sendStatus(type = "heartbeat") {
    await api.sendStatus({
      shutterState,
      type,
      source: "agent"
    });
  }

  async function heartbeatLoop() {
    while (true) {
      await sendStatus("heartbeat");
      await sleep(heartbeatMs);
    }
  }

  (async () => {
    log("Agent gestart");
    await sendStatus("startup");
    heartbeatLoop();
  })();
}
