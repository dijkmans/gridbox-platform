import { openShutter, closeShutter } from "../../gridbox-core/logic/shutterController.js";
import { lightOn, scheduleLightOff } from "../../gridbox-core/logic/lightController.js";
import { initSimulatorHardware } from "./simulatorHardware.js";
import { initSimulatorRuntime } from "./simulatorRuntime.js";

const hardware = initSimulatorHardware();

initSimulatorRuntime({ hardware });

hardware.onButtonPress(async () => {
  if (hardware.isShutterOpen()) {
    await closeShutter({
      source: "button",
      onRelayClose: hardware.relayClose,
      onLightOff: hardware.lightOff
    });

    scheduleLightOff({ onLightOff: hardware.lightOff });
  } else {
    lightOn({ onLightOn: hardware.lightOn });

    await openShutter({
      source: "button",
      onRelayOpen: hardware.relayOpen
    });
  }
});

window.simulateButton = () => hardware.simulateButton();
