import { startAgent } from "./agent.js";
import { createApiClient } from "./apiClient.js";

console.log("INDEX.JS WORDT UITGEVOERD");

const API_BASE_URL = "https://gridbox-api-960191535038.europe-west1.run.app";
const BOX_ID = "box-test-001";

console.log("API_BASE_URL =", API_BASE_URL);
console.log("BOX_ID =", BOX_ID);

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
