import { Gpio } from "onoff";
import { log } from "./logger.js";

let relay;

export async function initGPIO(config) {
  relay = new Gpio(config.relayPin, "out");
  relay.writeSync(0);
  log("GPIO klaar");
}

export function openRolluik() {
  if (!relay) return;
  relay.writeSync(1);
  setTimeout(() => relay.writeSync(0), 3000);
}

// Voorlopig dezelfde puls als OPEN.
// Als je later 2 relais hebt (open en close), passen we dit aan.
export function closeRolluik() {
  if (!relay) return;
  relay.writeSync(1);
  setTimeout(() => relay.writeSync(0), 3000);
}
