// Eenvoudige in-memory lijst van gridboxen
// Later vervangen we dit door Firestore.

const boxes = [
  {
    id: "heist-1",
    locationName: "Heist",
    number: 1,
    status: "online",
    description: "Gridbox Heist #1",
    cameraEnabled: true
  },
  {
    id: "mol-1",
    locationName: "Winkel Mol",
    number: 1,
    status: "online",
    description: "Gridbox Mol #1",
    cameraEnabled: true
  }
];

function getAllBoxes() {
  return boxes;
}

function getBoxById(id) {
  return boxes.find((b) => b.id === id);
}

module.exports = {
  getAllBoxes,
  getBoxById
};
