// raspberry-pi/agent/src/agent.js

import { openShutter, closeShutter } from "../../gridbox-core/logic/shutterController.js";
import { lightOn, scheduleLightOff } from "../../gridbox-core/logic/lightController.js";
import { initHardware } from "../hardware/raspberryHardware.js";
import { initRuntime } from "../runtime/raspberry.js";

export function startAgent() {
  const hardware = initHardware();

  initRuntime({
    onConfigUpdate: () => {
      // config wordt rechtstreeks in gridbox-core toegepast
    }
  });

  hardware.onButtonPress(async () => {
    if (hardware.isShutterOpen()) {
      await closeShutter({
        source: "button",
        onRelayClose: hardware.relayClose,
        onLightOff: hardware.lightOff
      });

      scheduleLightOff({
        onLightOff: hardware.lightOff
      });
    } else {
      lightOn({ onLightOn: hardware.lightOn });

      await openShutter({
        source: "button",
        onRelayOpen: hardware.relayOpen
      });
    }
  });

  console.log("Gridbox Raspberry Pi Agent running");
}
