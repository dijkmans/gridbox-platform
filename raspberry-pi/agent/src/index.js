// raspberry-pi/agent/src/index.js

import { startAgent } from "./agent.js";
import { createApiClient } from "./apiClient.js";
import { createSimHardware } from "./hardware/simHardware.js";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";
const ORG_ID = process.env.ORG_ID || "powergrid";
const BOX_ID = process.env.BOX_ID || "box-sim-001";

const api = createApiClient({
  apiBaseUrl: API_BASE_URL,
  orgId: ORG_ID,
  boxId: BOX_ID
});

const hardware = createSimHardware();

startAgent({
  api,
  hardware,
  config: {
    boxId: BOX_ID,
    pollMs: 5000,
    heartbeatMs: 10000,
    moveMs: 20000
  }
});
