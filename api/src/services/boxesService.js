// api/src/services/boxesService.js

const { boxes } = require("../data/mockData");
const { shares } = require("../data/mockData");

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
function getAll() {
  return Promise.resolve(boxes);
}

// ---------------------------------------------------------
// Eén box ophalen op ID
// ---------------------------------------------------------
function getById(id) {
  const box = boxes.find(b => b.id === id);
  return Promise.resolve(box || null);
}

// ---------------------------------------------------------
// Shares ophalen gekoppeld aan een box
// ---------------------------------------------------------
function getShares(boxId) {
  const result = shares.filter(s => s.boxId === boxId);
  return Promise.resolve(result);
}

// ---------------------------------------------------------
// Box openen (mock)
// ---------------------------------------------------------
function open(id) {
  const box = boxes.find(b => b.id === id);
  if (!box) return Promise.resolve(null);

  box.status = "open";
  box.lastOpened = new Date().toISOString();

  return Promise.resolve({
    success: true,
    message: `Box ${id} is geopend (mock)`,
    box,
  });
}

// ---------------------------------------------------------
// Box sluiten (mock)
// ---------------------------------------------------------
function close(id) {
  const box = boxes.find(b => b.id === id);
  if (!box) return Promise.resolve(null);

  box.status = "closed";

  return Promise.resolve({
    success: true,
    message: `Box ${id} is gesloten (mock)`,
    box,
  });
}

module.exports = {
  getAll,
  getById,
  getShares,
  open,
  close,
};
