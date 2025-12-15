import axios from "axios";
import { log } from "./logger.js";

let api;

export async function initApi(config) {
  api = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: 5000
  });

  await api.post("/devices/online", {
    boxId: config.boxId
  });

  log("API verbonden");
}

export async function sendEvent(type, payload) {
  try {
    await api.post("/events", { type, payload });
  } catch {
    log("API event mislukt");
  }
}
