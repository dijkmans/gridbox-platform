// api/src/services/boxesService.js

// ------------------------------------------------------
// Imports
// ------------------------------------------------------
const { getBox, listSharesForBox } = require("../db"); 
// BELANGRIJK: db.js zit één map hoger → "../db"


// ------------------------------------------------------
// Lokale mock boxen (wanneer Firestore niet actief is)
// ------------------------------------------------------
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
  },
];

const runningOnCloudRun = !!process.env.K_SERVICE;


// ------------------------------------------------------
// Alle boxen ophalen
// ------------------------------------------------------
async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }

  // TODO later: Firestore ophalen
  return localBoxes;
}


// ------------------------------------------------------
// Eén box ophalen via ID
// ------------------------------------------------------
async function getById(id) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === id) || null;
  }

  return await getBox(id);
}


// ------------------------------------------------------
// Shares koppelen aan een box
// ------------------------------------------------------
async function getShares(boxId) {
  return await listSharesForBox(boxId);
}


// ------------------------------------------------------
// Box openen (mock + klaar voor echte hardware)
// ------------------------------------------------------
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


// ------------------------------------------------------
// Box sluiten (mock)
// ------------------------------------------------------
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


// ------------------------------------------------------
// Exports
// ------------------------------------------------------
module.exports = {
  getAll,
  getById,
  getShares,
  open,
  close,
};
