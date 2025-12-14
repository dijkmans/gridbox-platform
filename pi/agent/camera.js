import { exec } from "child_process";
import { log } from "./logger.js";

export async function initCamera(config) {
  if (!config.cameraEnabled) return;
  log("Camera actief");
}

export function takePhoto() {
  exec("libcamera-still -o /tmp/gridbox.jpg", () => {
    log("Foto genomen");
  });
}
