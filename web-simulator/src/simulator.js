import { initSimulatorHardware } from "./simulatorHardware.js";
import { createStateManager } from "../../gridbox-core/state/stateManager.js";
import { createShutterController } from "../../gridbox-core/logic/shutterController.js";
import { createLightController } from "../../gridbox-core/logic/lightController.js";
import { startSimulatorAgent } from "./simulatorAgent.js";

const BOX_ID = "box-sim-001";

const hardware = initSimulatorHardware();

const stateManager = createStateManager({
  initialState: "closed"
});

const shutterController = createShutterController({
  hardware,
  stateManager
});

const lightController = createLightController({
  hardware,
  stateManager,
  config: { delayAfterCloseMs: 60000 }
});

// lokale knop blijft werken
hardware.onButtonPress(() => {
  if (stateManager.getState() === "open") {
    shutterController.close("button");
    lightController.onClose();
  } else {
    shutterController.open("button");
    lightController.onOpen();
  }
});

// start API agent (simuleert Raspberry Pi)
startSimulatorAgent({
  boxId: BOX_ID,
  shutterController,
  lightController,
  stateManager
});
