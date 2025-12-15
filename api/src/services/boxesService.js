// api/src/services/boxesService.js
import { getBox, listSharesForBox } from "../db.js";
import * as devicesService from "./devicesService.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale fallback boxen (voor lokaal draaien)
const localBoxes = [
  {
    id: "gbox-001",
    locationName: "Simulator",
    number: 1,
    status: "online",
    description: "Mock Gridbox 001",
    cameraEnabled: false,
  },
];

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
export async function getAll() {
  if (!runningOnCloudRun) return localBoxes;

  // Voor nu: minimaal, maar stabiel
  // Als je later “alle boxen” uit Firestore wil, maken we daar een aparte query voor.
  return localBoxes;
}

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(id) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === id) || null;
  }
  return getBox(id);
}

// ---------------------------------------------------------
// Shares voor box ophalen
// ---------------------------------------------------------
export async function getShares(boxId) {
  return listSharesForBox(boxId);
}

// ---------------------------------------------------------
// SMS flow: OPEN command maken
// ---------------------------------------------------------
export async function openBox(boxId, meta = {}) {
  const cmd = {
    type: "open",
    source: meta.source || "sms",
    requestedBy: meta.phone || null,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const created = await devicesService.addCommand(boxId, cmd);

  return {
    success: true,
    command: created,
  };
}

// Optioneel: CLOSE
export async function closeBox(boxId, meta = {}) {
  const cmd = {
    type: "close",
    source: meta.source || "sms",
    requestedBy: meta.phone || null,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const created = await devicesService.addCommand(boxId, cmd);

  return {
    success: true,
    command: created,
  };
}

// ---------------------------------------------------------
// Legacy endpoints /api/boxes/:id/open en /close
// ---------------------------------------------------------
export async function open(id) {
  return openBox(id, { source: "api" });
}

export async function close(id) {
  return closeBox(id, { source: "api" });
}
