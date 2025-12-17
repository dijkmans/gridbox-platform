import { startAgent } from "./agent.js";
import { createApiClient } from "./apiClient.js";
import { createSimHardware } from "./hardware/simHardware.js";

const API_BASE_URL = process.env.API_BASE_URL;
const ORG_ID = process.env.ORG_ID;
const BOX_ID = process.env.BOX_ID;

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
    boxId: BOX_ID
  }
});
