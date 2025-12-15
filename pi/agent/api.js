import axios from "axios";
import { log } from "./logger.js";

let api;
let boxId;

function normalizeBaseUrl(url) {
  if (!url) return "";
  let u = String(url).trim();
  // Zorg dat er geen trailing slash problemen zijn
  if (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

export async function initApi(config) {
  boxId = String(config.boxId);
  api = axios.create({
    baseURL: normalizeBaseUrl(config.apiBaseUrl),
    timeout: 7000
  });

  // kleine boot event (mag falen zonder crash)
  try {
    await sendEvent("PI_BOOT", { version: "agent-1.0" });
  } catch {
    // bewust leeg
  }

  log("API verbonden");
}

export async function sendStatus(status) {
  if (!api) throw new Error("API niet geïnitialiseerd");
  await api.post(`/status/${boxId}`, status);
}

export async function sendEvent(type, meta = {}) {
  if (!api) throw new Error("API niet geïnitialiseerd");
  await api.post(`/events/${boxId}`, {
    type,
    source: "pi",
    meta
  });
}

export async function fetchPendingCommands() {
  if (!api) throw new Error("API niet geïnitialiseerd");

  const res = await api.get(`/commands/${boxId}`);
  if (!res.data || res.data.ok !== true) return [];
  if (!Array.isArray(res.data.commands)) return [];
  return res.data.commands;
}

export async function ackCommand(commandId, result = "ok") {
  if (!api) throw new Error("API niet geïnitialiseerd");
  await api.post(`/commands/${boxId}/ack`, {
    commandId,
    result
  });
}
