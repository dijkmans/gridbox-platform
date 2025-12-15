// gridbox-core/logic/shutterController.js

/**
 * Shutter controller
 * Bepaalt de volgorde en het gedrag van openen en sluiten
 * Hardware-onafhankelijk
 */

import {
  startOpening,
  finishOpening,
  startClosing,
  finishClosing,
  getLightDelay,
  turnLightOff
} from "../state/stateManager.js";

/**
 * Open het rolluik
 *
 * source = "button" | "platform"
 * onRelayOpen = functie die het OPEN relais pulseert
 * onDone = callback na voltooiing
 */
export async function openShutter({
  source,
  onRelayOpen,
  onDone
}) {
  const started = startOpening(source);
  if (!started) {
    return false;
  }

  // Hardware actie: rolluik openen
  await onRelayOpen();

  // Rolluik is open
  finishOpening();

  if (typeof onDone === "function") {
    onDone();
  }

  return true;
}

/**
 * Sluit het rolluik
 *
 * source = "button" | "platform"
 * onRelayClose = functie die het CLOSE relais pulseert
 * onLightOff = functie die licht uit zet
 * onDone = callback na voltooiing
 */
export async function closeShutter({
  source,
  onRelayClose,
  onLightOff,
  onDone
}) {
  const started = startClosing(source);
  if (!started) {
    return false;
  }

  // Hardware actie: rolluik sluiten
  await onRelayClose();

  // Rolluik is dicht
  finishClosing();

  // Licht vertraagd uitschakelen
  const delay = getLightDelay();

  setTimeout(() => {
    turnLightOff();
    if (typeof onLightOff === "function") {
      onLightOff();
    }
  }, delay);

  if (typeof onDone === "function") {
    onDone();
  }

  return true;
}
