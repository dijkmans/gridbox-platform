/**
 * Shutter controller
 * Regelt openen en sluiten van het rolluik
 * Los van hardware, platform en UI
 */

export function createShutterController({ hardware, stateManager }) {
  return {
    /**
     * Open de Gridbox
     */
    open(source = "unknown") {
      const current = stateManager.getState();

      // veiligheid: niet opnieuw openen
      if (current === "open" || current === "opening") {
        return;
      }

      // state eerst
      stateManager.setState("opening", { source });

      // hardware actie
      hardware.openShutter();

      // eindstate
      stateManager.setState("open", { source });
    },

    /**
     * Sluit de Gridbox
     */
    close(source = "unknown") {
      const current = stateManager.getState();

      // veiligheid: niet opnieuw sluiten
      if (current === "closed" || current === "closing") {
        return;
      }

      stateManager.setState("closing", { source });

      hardware.closeShutter();

      stateManager.setState("closed", { source });
    }
  };
}
