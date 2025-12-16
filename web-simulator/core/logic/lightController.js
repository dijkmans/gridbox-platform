// core/logic/lightController.js

export function createLightController({ hardware, stateManager, config = {} }) {
  const delayMs =
    config.delayAfterCloseMs ??
    stateManager.getLightDelay();

  let offTimeout = null;

  return {
    onOpen() {
      if (offTimeout) {
        clearTimeout(offTimeout);
        offTimeout = null;
      }
      hardware.lightOn();
    },

    onClose() {
      offTimeout = setTimeout(() => {
        hardware.lightOff();
        stateManager.turnLightOff();
      }, delayMs);
    }
  };
}
