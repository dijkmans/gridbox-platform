// src/boxes.js
const { firestore } = require("./db");

const COLLECTION = "boxes";

async function getAllBoxes() {
  const snapshot = await firestore.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getBoxById(id) {
  const doc = await firestore.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function upsertBox(id, data) {
  await firestore.collection(COLLECTION).doc(id).set(data, { merge: true });
  return getBoxById(id);
}

module.exports = {
  getAllBoxes,
  getBoxById,
  upsertBox
};
