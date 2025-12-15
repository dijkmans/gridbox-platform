// gridbox-core/logic/lightController.js

/**
 * Light controller
 * Regelt lichtgedrag los van hardware
 * Wordt aangestuurd door shutter logic
 */

import {
  setConfig,
  turnLightOff,
  getLightDelay,
  getState
} from "../state/stateManager.js";

let offTimer = null;

/**
 * Zet het licht onmiddellijk aan
 * onLightOn = hardware callback
 */
export function lightOn({ onLightOn }) {
  // Annuleer eventueel geplande uitschakeling
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }

  if (typeof onLightOn === "function") {
    onLightOn();
  }
}

/**
 * Plan het licht om uit te gaan na vertraging
 * onLightOff = hardware callback
 */
export function scheduleLightOff({ onLightOff }) {
  const delay = getLightDelay();

  // Annuleer bestaande timer
  if (offTimer) {
    clearTimeout(offTimer);
  }

  offTimer = setTimeout(() => {
    turnLightOff();

    if (typeof onLightOff === "function") {
      onLightOff();
    }

    offTimer = null;
  }, delay);
}

/**
 * Forceer licht onmiddellijk uit
 * Wordt bv. gebruikt bij noodstop of reset
 */
export function forceLightOff({ onLightOff }) {
  if (offTimer) {
    clearTimeout(offTimer);
    offTimer = null;
  }

  turnLightOff();

  if (typeof onLightOff === "function") {
    onLightOff();
  }
}

/**
 * Update lichtconfig via platform
 * Bijvoorbeeld lichtvertraging aanpassen
 */
export function updateLightConfig(config = {}) {
  setConfig(config);
}

/**
 * Debug helper
 */
export function getLightStatus() {
  const state = getState();
  return state.light;
}
