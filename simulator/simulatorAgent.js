// simulator/simulatorAgent.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startSimulatorAgent({
  hardware,
  stateManager,
  shutterController,
  lightController,
  config = {}
}) {
  const API_BASE_URL = config.apiBaseUrl || process.env.API_BASE_URL || "http://localhost:8080";
  const ORG_ID = config.orgId || process.env.ORG_ID || "powergrid";
  const BOX_ID = config.boxId || process.env.BOX_ID || "box-sim-001";

  const POLL_MS = Number(config.pollMs || 5000);
  const HEARTBEAT_MS = Number(config.heartbeatMs || 10000);
  const SHUTTER_MOVE_MS = Number(config.shutterMoveMs || 20000);

  const base = `${API_BASE_URL}/api/orgs/${ORG_ID}/boxes/${BOX_ID}`;

  async function postJson(path, body) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`POST ${path} failed: ${res.status} ${txt}`);
    }
    return res.json().catch(() => ({}));
  }

  async function getJson(path) {
    const res = await fetch(`${base}${path}`, { method: "GET" });
    if (res.status === 204) return null;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GET ${path} failed: ${res.status} ${txt}`);
    }
    return res.json();
  }

  async function sendStatus({ shutterState, lightState }) {
    await postJson("/status", { shutterState, lightState });
  }

  async function sendEvent(type, payload = {}, result = "ok", errorCode = null) {
    await postJson("/events", {
      type,
      payload,
      result,
      errorCode,
      triggerType: "device",
      actorType: "device",
      actorId: "simulator"
    });
  }

  async function sendCommandResult(commandId, ok, errorCode = null, errorMessage = null) {
    await postJson(`/commands/${commandId}/result`, { ok, errorCode, errorMessage });
  }

  let busy = false;

  async function doOpen(source, commandId = null) {
    if (busy) return;
    busy = true;
    try {
      await sendEvent("shutter.opening", { source, commandId });
      await sendStatus({ shutterState: "OPENING" });

      try {
        shutterController.open(source);
      } catch {}

      await sleep(SHUTTER_MOVE_MS);

      await sendEvent("shutter.opened", { source, commandId });
      await sendStatus({ shutterState: "OPEN" });

      if (commandId) await sendCommandResult(commandId, true);
    } catch (e) {
      if (commandId) await sendCommandResult(commandId, false, "open_failed", e.message);
    } finally {
      busy = false;
    }
  }

  async function doClose(source, commandId = null) {
    if (busy) return;
    busy = true;
    try {
      await sendEvent("shutter.closing", { source, commandId });
      await sendStatus({ shutterState: "CLOSING" });

      try {
        shutterController.close(source);
        lightController?.onClose?.();
      } catch {}

      await sleep(SHUTTER_MOVE_MS);

      await sendEvent("shutter.closed", { source, commandId });
      await sendStatus({ shutterState: "CLOSED" });

      if (commandId) await sendCommandResult(commandId, true);
    } catch (e) {
      if (commandId) await sendCommandResult(commandId, false, "close_failed", e.message);
    } finally {
      busy = false;
    }
  }

  async function handleButton() {
    await sendEvent("button.pressed", {});
    if (stateManager?.isOpen?.()) {
      await doClose("button");
    } else {
      await doOpen("button");
    }
  }

  function wireHardware() {
    hardware?.onButtonPress?.(() => {
      handleButton().catch(() => {});
    });

    hardware?.onLightToggle?.(() => {
      try {
        const next = !stateManager?.isLightOn?.();
        lightController?.set?.(next);
        sendStatus({ lightState: next }).catch(() => {});
        sendEvent("light.toggled", { lightState: next }).catch(() => {});
      } catch {}
    });
  }

  async function heartbeatLoop() {
    while (true) {
      try {
        const shutterState = stateManager?.isOpen?.() ? "OPEN" : "CLOSED";
        const lightState = stateManager?.isLightOn?. ? !!stateManager.isLightOn() : undefined;
        await sendStatus({ shutterState, lightState });
      } catch {}
      await sleep(HEARTBEAT_MS);
    }
  }

  async function commandLoop() {
    while (true) {
      try {
        const data = await getJson("/commands/next");
        if (data?.command) {
          const { id, type } = data.command;
          if (type === "open") await doOpen("api", id);
          if (type === "close") await doClose("api", id);
        }
      } catch {}
      await sleep(POLL_MS);
    }
  }

  (async () => {
    wireHardware();
    await sendEvent("device.simulator.started", { boxId: BOX_ID });
    await sendStatus({ shutterState: stateManager?.isOpen?.() ? "OPEN" : "CLOSED" });
    heartbeatLoop();
    commandLoop();
  })();
}
