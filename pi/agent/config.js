import fs from "fs";

export function loadConfig() {
  const raw = fs.readFileSync("/opt/gridbox/config/device.json");
  return JSON.parse(raw);
}
