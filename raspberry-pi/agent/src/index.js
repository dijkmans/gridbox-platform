// raspberry-pi/agent/src/index.js

import { startAgent } from "./agent.js";
import { createApiClient } from "./apiClient.js";

const API_BASE_URL = "https://gridbox-api-960191535038.europe-west1.run.app";
const BOX_ID = "box-test-001";

console.log("[BOOT] Agent index.js gestart");
console.log("[BOOT] API:", API_BASE_URL);
console.log("[BOOT] BOX_ID:", BOX_ID);

const api = createApiClient({
  apiBaseUrl: API_BASE_URL,
  boxId: BOX_ID
});

startAgent({
  api,
  config: {
    boxId: BOX_ID,
    heartbeatMs: 5000,
    commandPollMs: 3000
  }
});
