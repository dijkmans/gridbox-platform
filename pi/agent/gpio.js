import { Gpio } from "onoff";
import { log } from "./logger.js";

let relay;

export async function initGPIO(config) {
  relay = new Gpio(config.relayPin, "out");
  relay.writeSync(0);
  log("GPIO klaar");
}

export function openRolluik() {
  relay.writeSync(1);
  setTimeout(() => relay.writeSync(0), 3000);
}
