// api/src/services/boxesService.js

// Mock data (tijdelijk)
// Later vervangen door Firestore
const mockBoxes = [
  { id: "1", location: "Geel", status: "closed" },
  { id: "2", location: "Mol", status: "open" }
];

const mockShares = [
  { id: "s1", boxId: "1", phoneNumber: "+32470000000", code: "123456" },
  { id: "s2", boxId: "1", phoneNumber: "+32470000001", code: "654321" },
  { id: "s3", boxId: "2", phoneNumber: "+32470000002", code: "111111" }
];

module.exports = {
  // ---------------------------------------------------------
  // Haal ALLE boxen op
  // ---------------------------------------------------------
  getAll() {
    return mockBoxes;
  },

  // ---------------------------------------------------------
  // Haal één box op via id
  // ---------------------------------------------------------
  getById(id) {
    return mockBoxes.find((b) => b.id === id) || null;
  },

  // ---------------------------------------------------------
  // Haal alle shares op die bij een box horen
  // ---------------------------------------------------------
  getShares(boxId) {
    return mockShares.filter((s) => s.boxId === boxId);
  },

  // ---------------------------------------------------------
  // Box openen (mock)
  // Later: API call naar Raspberry Pi
  // ---------------------------------------------------------
  open(boxId) {
    console.log(`Mock: open commando ontvangen voor box ${boxId}`);

    const box = mockBoxes.find((b) => b.id === boxId);
    if (box) {
      box.status = "open";
    }

    return {
      status: "ok",
      message: `Box ${boxId} geopend (mock)`,
      box: box || null
    };
  },

  // ---------------------------------------------------------
  // Box sluiten (mock)
  // ---------------------------------------------------------
  close(boxId) {
    console.log(`Mock: close commando ontvangen voor box ${boxId}`);

    const box = mockBoxes.find((b) => b.id === boxId);
    if (box) {
      box.status = "closed";
    }

    return {
      status: "ok",
      message: `Box ${boxId} gesloten (mock)`,
      box: box || null
    };
  }
};
