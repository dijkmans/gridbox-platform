// stateManager.js
// Centrale toestand van één Gridbox
// Hardware-onafhankelijk
// Wordt gebruikt door simulator en Raspberry Pi

const state = {
  shutter: "closed",      // closed | opening | open | closing
  light: "off",           // on | off
  lastAction: null,       // button | platform | null
  updatedAt: null,
  config: {
    lightDelayAfterCloseMs: 60000
  }
};

// --------------------
// interne helpers
// --------------------

function updateTimestamp() {
  state.updatedAt = new Date().toISOString();
}

// --------------------
// publieke API
// --------------------

export function getState() {
  return JSON.parse(JSON.stringify(state));
}

export function setConfig(newConfig = {}) {
  if (typeof newConfig.lightDelayAfterCloseMs === "number") {
    state.config.lightDelayAfterCloseMs = newConfig.lightDelayAfterCloseMs;
    updateTimestamp();
  }
}

// --------------------
// shutter logica
// --------------------

export function startOpening(source) {
  if (state.shutter === "open" || state.shutter === "opening") {
    return false;
  }

  state.shutter = "opening";
  state.light = "on";
  state.lastAction = source;
  updateTimestamp();
  return true;
}

export function finishOpening() {
  state.shutter = "open";
  updateTimestamp();
}

export function startClosing(source) {
  if (state.shutter === "closed" || state.shutter === "closing") {
    return false;
  }

  state.shutter = "closing";
  state.lastAction = source;
  updateTimestamp();
  return true;
}

export function finishClosing() {
  state.shutter = "closed";
  updateTimestamp();
}

// --------------------
// licht logica
// --------------------

export function turnLightOn() {
  state.light = "on";
  updateTimestamp();
}

export function turnLightOff() {
  state.light = "off";
  updateTimestamp();
}

// --------------------
// status helpers
// --------------------

export function isOpen() {
  return state.shutter === "open";
}

export function isClosed() {
  return state.shutter === "closed";
}

export function isMoving() {
  return state.shutter === "opening" || state.shutter === "closing";
}

export function getLightDelay() {
  return state.config.lightDelayAfterCloseMs;
}
