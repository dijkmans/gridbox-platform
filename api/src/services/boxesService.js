// api/src/services/boxesService.js
import { getBox, listSharesForBox } from "../db.js";

// Lokale fallback mock boxen (bij ontwikkeling of wanneer Firestore niet actief is)
const localBoxes = [
  {
    id: "heist-1",
    locationName: "Heist",
    number: 1,
    status: "online",
    description: "Mock Gridbox Heist #1",
    cameraEnabled: true
  },
  {
    id: "geel-1",
    locationName: "Geel",
    number: 1,
    status: "online",
    description: "Mock Gridbox Geel #1",
    cameraEnabled: true
  }
];

// Cloud Run detectie
const runningOnCloudRun = !!process.env.K_SERVICE;

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
export async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }

  // TODO: Vervangen door Firestore-query
  return localBoxes;
}

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(id) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === id) || null;
  }

  return await getBox(id);
}

// ---------------------------------------------------------
// Shares voor box ophalen
// ---------------------------------------------------------
export async function getShares(boxId) {
  return await listSharesForBox(boxId);
}

// ---------------------------------------------------------
// Box openen
// ---------------------------------------------------------
export async function open(id) {
  const box = localBoxes.find((b) => b.id === id);

  if (!box) {
    return { success: false, message: `Box ${id} niet gevonden` };
  }

  box.status = "open";
  box.lastOpened = new Date().toISOString();

  return {
    success: true,
    action: "open",
    message: `Mock: box ${id} is geopend`,
    box
  };
}

// ---------------------------------------------------------
// Box sluiten
// ---------------------------------------------------------
export async function close(id) {
  const box = localBoxes.find((b) => b.id === id);

  if (!box) {
    return { success: false, message: `Box ${id} niet gevonden` };
  }

  box.status = "closed";

  return {
    success: true,
    action: "close",
    message: `Mock: box ${id} is gesloten`,
    box
  };
}
