// raspberry-pi/agent/runtime/raspberry.js

import fetch from "node-fetch";
import { updateLightConfig } from "../../../gridbox-core/logic/lightController.js";

const PLATFORM_URL = "http://localhost:8080"; // later productie-URL

export async function initRuntime({ onConfigUpdate }) {
  try {
    const response = await fetch(`${PLATFORM_URL}/api/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "gbox-001",
        type: "gridbox",
        softwareVersion: "0.1.0"
      })
    });

    const data = await response.json();

    if (data.config) {
      updateLightConfig(data.config);
    }

    console.log("Device registered on platform");
  } catch (err) {
    console.warn("Platform not reachable, running offline");
  }
}
