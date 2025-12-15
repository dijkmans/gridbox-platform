// api/src/services/boxesService.js
import { getBox, listSharesForBox } from "../db.js";
import * as devicesService from "./devicesService.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale fallback (alleen lokaal)
const localBoxes = [
  {
    id: "gbox-001",
    locationName: "Simulator",
    number: 1,
    status: "online",
    description: "Mock Gridbox 001",
    cameraEnabled: false
  }
];

// ----------------------------------------------------
// Box ophalen
// ----------------------------------------------------
export async function getById(boxId) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === boxId) || null;
  }
  return getBox(boxId);
}

// ----------------------------------------------------
// Shares voor box
// ----------------------------------------------------
export async function getShares(boxId) {
  return listSharesForBox(boxId);
}

// ----------------------------------------------------
// OPEN via SMS
// ----------------------------------------------------
export async function openBox(boxId, meta = {}) {
  const command = {
    type: "open",
    source: meta.source || "sms",
    requestedBy: meta.phone || null,
    createdAt: new Date().toISOString(),
    status: "pending"
  };

  const created = await devicesService.addCommand(boxId, command);

  return {
    success: true,
    command: created
  };
}

// ----------------------------------------------------
// CLOSE (voor later)
// ----------------------------------------------------
export async function closeBox(boxId, meta = {}) {
  const command = {
    type: "close",
    source: meta.source || "sms",
    requestedBy: meta.phone || null,
    createdAt: new Date().toISOString(),
    status: "pending"
  };

  const created = await devicesService.addCommand(boxId, command);

  return {
    success: true,
    command: created
  };
}

// Legacy
export async function open(id) {
  return openBox(id, { source: "api" });
}

export async function close(id) {
  return closeBox(id, { source: "api" });
}
