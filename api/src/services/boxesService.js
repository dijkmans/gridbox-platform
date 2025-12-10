// api/src/services/boxesService.js

const { getBox, listSharesForBox } = require("./db");

// Lokale fallback mock boxen (als Firestore niet actief is)
const localBoxes = [
  {
    id: "heist-1",
    locationName: "Heist",
    number: 1,
    status: "online",
    description: "Mock Gridbox Heist #1",
    cameraEnabled: true,
  },
  {
    id: "geel-1",
    locationName: "Geel",
    number: 1,
    status: "online",
    description: "Mock Gridbox Geel #1",
    cameraEnabled: true,
  }
];

// Check of we op Cloud Run draaien (Firestore actief)
const runningOnCloudRun = !!process.env.K_SERVICE;

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }

  // Firestore komt later. Voor nu mock teruggeven.
  return localBoxes;
}

// ---------------------------------------------------------
// Eén box ophalen op ID
// ---------------------------------------------------------
async function getById(id) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === id) || null;
  }

  // Cloud Run → Firestore
  return await getBox(id);
}

// ---------------------------------------------------------
// Shares ophalen gekoppeld aan een box
// ---------------------------------------------------------
async function getShares(boxId) {
  return await listSharesForBox(boxId);
}

// ---------------------------------------------------------
// Box openen (mock)
// ---------------------------------------------------------
async function open(id) {
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
    box,
  };
}

// ---------------------------------------------------------
// Box sluiten (mock)
// ---------------------------------------------------------
async function close(id) {
  const box = localBoxes.find((b) => b.id === id);
  if (!box) {
    return { success: false, message: `Box ${id} niet gevonden` };
  }

  box.status = "closed";

  return {
    success: true,
    action: "close",
    message: `Mock: box ${id} is gesloten`,
    box,
  };
}

module.exports = {
  getAll,
  getById,
  getShares,
  open,
  close,
};
