// src/db.js
// Eenvoudige DB-laag voor boxes en shares
// - In Cloud Run: Firestore
// - Lokaal: in-memory mock (geen Firestore nodig)

const { Firestore } = require("@google-cloud/firestore");

// Cloud Run zet env variabele K_SERVICE
const isCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (isCloudRun) {
  firestore = new Firestore();
  console.log("DB: using Firestore (Cloud Run mode)");
} else {
  console.log("DB: using in-memory MOCK database (local dev)");
}

// In-memory mock data voor lokaal gebruik
const mockState = {
  boxes: [
    {
      id: "heist-1",
      locationName: "Heist",
      number: 1,
      status: "online",
      description: "Gridbox Heist #1",
      cameraEnabled: true,
      locationId: "Powergrid-Heist"
    }
  ],
  shares: []
};

// Helpers
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// BOXES
async function listBoxes() {
  if (!isCloudRun) {
    return mockState.boxes;
  }

  const snapshot = await firestore.collection("boxes").get();
  const results = [];
  snapshot.forEach(doc => {
    results.push({ id: doc.id, ...doc.data() });
  });
  return results;
}

async function getBoxById(id) {
  if (!isCloudRun) {
    return mockState.boxes.find(b => b.id === id) || null;
  }

  const doc = await firestore.collection("boxes").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// SHARES
async function listSharesForBox(boxId) {
  if (!isCloudRun) {
    return mockState.shares.filter(s => s.boxId === boxId);
  }

  const snapshot = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .orderBy("createdAt", "desc")
    .get();

  const results = [];
  snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
  return results;
}

async function createShare({ boxId, phoneNumber }) {
  const base = {
    boxId,
    phoneNumber,
    code: generateCode(),
    status: "active",
    createdAt: new Date().toISOString()
  };

  if (!isCloudRun) {
    const share = {
      id: `mock-${mockState.shares.length + 1}`,
      ...base
    };
    mockState.shares.push(share);
    return share;
  }

  const docRef = await firestore.collection("shares").add({
    ...base,
    createdAt: Firestore.Timestamp.fromDate(new Date())
  });

  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() };
}

module.exports = {
  listBoxes,
  getBoxById,
  listSharesForBox,
  createShare
};
