/**
 * Light controller
 * Regelt lichtgedrag los van hardware
 * Geen kennis van GPIO, UI of platform
 */

export function createLightController({ hardware, stateManager, config = {} }) {
  const {
    delayAfterCloseMs = 60000 // standaard 60 seconden
  } = config;

  let offTimer = null;

  function clearOffTimer() {
    if (offTimer) {
      clearTimeout(offTimer);
      offTimer = null;
    }
  }

  return {
    /**
     * Wordt aangeroepen wanneer de Gridbox opent
     * Licht moet onmiddellijk aan
     */
    onOpen() {
      clearOffTimer();
      hardware.lightOn();
    },

    /**
     * Wordt aangeroepen wanneer de Gridbox sluit
     * Licht blijft nog even aan
     */
    onClose() {
      clearOffTimer();

      offTimer = setTimeout(() => {
        // extra veiligheid: alleen uit als box nog steeds dicht is
        if (stateManager.getState() === "closed") {
          hardware.lightOff();
        }
        offTimer = null;
      }, delayAfterCloseMs);
    },

    /**
     * Noodstop / reset
     */
    forceOff() {
      clearOffTimer();
      hardware.lightOff();
    }
  };
}
