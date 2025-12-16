// core/logic/shutterController.js

export function createShutterController({ hardware, stateManager }) {
  return {
    open(source = "unknown") {
      const ok = stateManager.startOpening(source);
      if (!ok) return;

      hardware.relayOpen();

      // simulatie: na 1s is rolluik open
      setTimeout(() => {
        stateManager.finishOpening();
      }, 1000);
    },

    close(source = "unknown") {
      const ok = stateManager.startClosing(source);
      if (!ok) return;

      hardware.relayClose();

      // simulatie: na 1s is rolluik gesloten
      setTimeout(() => {
        stateManager.finishClosing();
      }, 1000);
    }
  };
}
