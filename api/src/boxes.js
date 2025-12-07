const { firestore } = require("./db");

const COLLECTION = "boxes";

// Alle boxen ophalen
async function getAllBoxes() {
  const snapshot = await firestore.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Eén box ophalen
async function getBoxById(id) {
  const doc = await firestore.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data()
  };
}

// Box aanmaken of bijwerken
async function upsertBox(id, data) {
  await firestore.collection(COLLECTION).doc(id).set(data, { merge: true });
  return getBoxById(id);
}

module.exports = {
  getAllBoxes,
  getBoxById,
  upsertBox
};

