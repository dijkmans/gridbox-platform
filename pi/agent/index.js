import { loadConfig } from "./config.js";
import { initApi } from "./api.js";
import { initGPIO } from "./gpio.js";
import { initRFID } from "./rfid.js";
import { initCamera } from "./camera.js";
import { startTunnel } from "./autossh.js";
import { log } from "./logger.js";

const config = loadConfig();

log("Gridbox agent start");

await initApi(config);
await initGPIO(config);
await initRFID(config);
await initCamera(config);
startTunnel(config);

setInterval(() => {
  log("agent alive");
}, 30000);
