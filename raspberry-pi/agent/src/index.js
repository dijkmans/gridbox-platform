console.log("### INDEX.JS WORDT GELADEN ###");

// raspberry-pi/agent/src/index.js

import { startAgent } from "./agent.js";
import { createApiClient } from "./apiClient.js";

// ------------------------------------
// ENV VARS (fallback voor lokaal testen)
// ------------------------------------
const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://gridbox-api-960191535038.europe-west1.run.app";

const ORG_ID =
  process.env.ORG_ID || "local-org";

const BOX_ID =
  process.env.BOX_ID || "box-test-001";

// ------------------------------------
// LOG VOOR CONTROLE
// ------------------------------------
console.log("API_BASE_URL =", API_BASE_URL);
console.log("ORG_ID       =", ORG_ID);
console.log("BOX_ID       =", BOX_ID);

// ------------------------------------
// API CLIENT
// ------------------------------------
const api = createApiClient({
  apiBaseUrl: API_BASE_URL,
  boxId: BOX_ID
});

// ------------------------------------
// START AGENT
// ------------------------------------
startAgent({
  api,
  config: {
    boxId: BOX_ID
  }
});
