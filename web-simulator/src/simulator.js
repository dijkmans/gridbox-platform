import { initSimulatorHardware } from "./simulatorHardware.js";
import * as stateManager from "../core/state/stateManager.js";
import { createShutterController } from "../core/logic/shutterController.js";
import { createLightController } from "../core/logic/lightController.js";

const hardware = initSimulatorHardware();

const shutterController = createShutterController({
  hardware,
  stateManager
});

const lightController = createLightController({
  hardware,
  stateManager,
  config: { delayAfterCloseMs: 60000 }
});

// logica bij knop
hardware.onButtonPress(() => {
  if (stateManager.isOpen()) {
    shutterController.close("button");
    lightController.onClose();
  } else {
    shutterController.open("button");
    lightController.onOpen();
  }
});

// HTML knop koppelen
const btn = document.getElementById("btn");
if (btn) {
  btn.addEventListener("click", () => {
    hardware.simulateButtonPress();
  });
}
