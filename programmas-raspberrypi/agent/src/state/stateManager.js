import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, "stateStore.json");

let state = loadState();

/**
 * Laad state uit bestand
 */
function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("State file not found, using defaults");
    return {
      shutter: "closed",
      light: "off",
      lastAction: null,
      updatedAt: null
    };
  }
}

/**
 * Bewaar state naar bestand
 */
function saveState() {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Haal huidige state op
 */
export function getState() {
  return { ...state };
}

/**
 * Zet rolluikstatus
 */
export function setShutterState(newState, source) {
  const allowed = ["open", "closed", "opening", "closing"];
  if (!allowed.includes(newState)) {
    throw new Error(`Invalid shutter state: ${newState}`);
  }

  state.shutter = newState;
  state.lastAction = source;
  saveState();
}

/**
 * Zet lichtstatus
 */
export function setLightState(newState) {
  const allowed = ["on", "off"];
  if (!allowed.includes(newState)) {
    throw new Error(`Invalid light state: ${newState}`);
  }

  state.light = newState;
  saveState();
}

/**
 * Helpers
 */
export function isShutterOpen() {
  return state.shutter === "open";
}

export function isShutterClosed() {
  return state.shutter === "closed";
}

export function isMoving() {
  return state.shutter === "opening" || state.shutter === "closing";
}
