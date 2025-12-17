// simulator/simulatorAgent.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startSimulatorAgent({
  hardware,
  stateManager,
  shutterController,
  lightController,
  config = {}
}) {
  const API_BASE_URL =
    config.apiBaseUrl || process.env.API_BASE_URL || "http://localhost:8080";

  const BOX_ID = config.boxId || process.env.BOX_ID || "gbox-001";
  const DEVICE_ID = config.deviceId || process.env.DEVICE_ID || "sim-1";

  const POLL_MS = Number(config.pollMs || 5000);
  const HEARTBEAT_MS = Number(config.heartbeatMs || 10000);
  const SHUTTER_MOVE_MS = Number(config.shutterMoveMs || 20000);

  const base = `${API_BASE_URL}/api/boxes/${BOX_ID}/device`;

  // ------------------------
  // helpers
  // ------------------------
  async function postJson(path, body) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`POST ${path} ${res.status} ${txt}`);
    }

    return res.json().catch(() => ({}));
  }

  async function getJson(path) {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GET ${path} ${res.status} ${txt}`);
    }
    return res.json();
  }

  // ------------------------
  // status
  // ------------------------
  async function sendStatus(extra = {}) {
    const shutterState = stateManager?.isOpen?.() ? "OPEN" : "CLOSED";
    const lightState = stateManager?.isLightOn?.()
      ? "ON"
      : "OFF";

    await postJson("/status", {
      shutterState,
      lightState,
      deviceId: DEVICE_ID,
      source: "simulator",
      ...extra
    });
  }

  let busy = false;

  async function doOpen(commandId) {
    if (busy) return;
    busy = true;

    try {
      await sendStatus({ action: "opening" });
      shutterController?.open?.("api");
      await sleep(SHUTTER_MOVE_MS);
      await sendStatus({ action: "opened" });

      // ❗️STAP 2.2: GEEN RESULT TERUGSTUREN
      // await postJson(`/commands/${commandId}/result`, {
      //   ok: true,
      //   result: { type: "open" }
      // });

    } finally {
      busy = false;
    }
  }

  async function doClose(commandId) {
    if (busy) return;
    busy = true;

    try {
      await sendStatus({ action: "closing" });
      shutterController?.close?.("api");
      lightController?.onClose?.();
      await sleep(SHUTTER_MOVE_MS);
      await sendStatus({ action: "closed" });

      // ❗️STAP 2.2: GEEN RESULT TERUGSTUREN
      // await postJson(`/commands/${commandId}/result`, {
      //   ok: true,
      //   result: { type: "close" }
      // });

    } finally {
      busy = false;
    }
  }

  // ------------------------
  // loops
  // ------------------------
  async function heartbeatLoop() {
    while (true) {
      try {
        await sendStatus();
      } catch {}
      await sleep(HEARTBEAT_MS);
    }
  }

  async function commandLoop() {
    while (true) {
      try {
        const data = await getJson(
          `/commands/next?deviceId=${DEVICE_ID}`
        );

        if (data?.command) {
          const { id, type } = data.command;
          if (type === "open") await doOpen(id);
          if (type === "close") await doClose(id);
        }
      } catch (e) {
        console.error("commandLoop error", e.message);
      }

      await sleep(POLL_MS);
    }
  }

  // ------------------------
  // start
  // ------------------------
  (async () => {
    await sendStatus({ started: true });
    heartbeatLoop();
    commandLoop();
  })();
}
