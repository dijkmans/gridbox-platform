import { initSimulatorHardware } from "./simulatorHardware.js";

const hardware = initSimulatorHardware();

hardware.onButtonPress(() => {
  if (hardware.isShutterOpen()) {
    hardware.relayClose();
    hardware.lightOff();
  } else {
    hardware.relayOpen();
    hardware.lightOn();
  }
});

document.getElementById("btn").addEventListener("click", () => {
  hardware.simulateButtonPress();
});
