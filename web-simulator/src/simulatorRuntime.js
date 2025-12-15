import { initRuntime as initPlatformRuntime } from "../../raspberry-pi/agent/runtime/raspberry.js";

export function initSimulatorRuntime({ hardware }) {
  initPlatformRuntime({ hardware });
}
