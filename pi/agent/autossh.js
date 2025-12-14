import { exec } from "child_process";
import { log } from "./logger.js";

export function startTunnel(config) {
  const cmd = `
autossh -M 0 -N \
-o ServerAliveInterval=30 \
-o ServerAliveCountMax=3 \
-R ${config.tunnelPort}:localhost:22 \
${config.tunnelUser}@${config.tunnelHost}
`;

  exec(cmd);
  log("Tunnel gestart");
}
