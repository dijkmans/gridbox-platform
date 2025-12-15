// gridbox-core/state/stateManager.js

/**
 * Centrale toestand van één Gridbox
 * Hardware-onafhankelijk
 * Wordt gebruikt door Raspberry Pi en simulator
 */

const state = {
  shutter: "closed",      // closed | opening | open | closing
  light: "off",           // on | off
  lastAction: null,       // button | platform | null
  updatedAt: null,
  config: {
    lightDelayAfterCloseMs: 60000 // default, kan door platform overschreven worden
  }
};

/**
 * Interne helper
 */
function updateTimestamp() {
  state.updatedAt = new Date().toISOString();
}

/**
 * Publieke API
 */

export function getState() {
  return JSON.parse(JSON.stringify(state));
}

export function setConfig(newConfig = {}) {
  if (typeof newConfig.lightDelayAfterCloseMs === "number") {
    state.config.lightDelayAfterCloseMs = newConfig.lightDelayAfterCloseMs;
    updateTimestamp();
  }
}

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

export function turnLightOff() {
  state.light = "off";
  updateTimestamp();
}

/**
 * Helpers
 */

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
