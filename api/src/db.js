// src/db.js

// In Cloud Run zetten we NODE_ENV=production.
// Lokaal is NODE_ENV meestal niet gezet => dan gebruiken we mock data.
const isProd = process.env.NODE_ENV === "production";

let firestore = null;

if (isProd) {
  const { Firestore } = require("@google-cloud/firestore");
  firestore = new Firestore();
  console.log("DB: Firestore modus (production)");
} else {
  console.log("DB: MOCK modus (lokaal, zonder Firestore)");
}

// Mock data voor lokaal testen
const mockBoxes = [
  {
    id: "heist-1",
    locationName: "Heist",
    number: 1,
    status: "online",
    description: "Gridbox Heist #1 (mock)",
    cameraEnabled: true,
  },
];

const mockShares = [];

// Helpers
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 cijfers
}

// ---------- Boxes ----------

async function listBoxes() {
  if (!isProd) {
    return mockBoxes;
  }

  const snapshot = await firestore.collection("boxes").get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function getBoxById(id) {
  if (!isProd) {
    return mockBoxes.find((b) => b.id === id) || null;
  }

  const doc = await firestore.collection("boxes").doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return {
    id: doc.id,
    ...doc.data(),
  };
}

// ---------- Shares ----------

async function createShare({ boxId, phoneNumber }) {
  const createdAt = new Date();
  const code = generateCode();

  if (!isProd) {
    // Lokaal: gewoon in geheugen bewaren
    const share = {
      id: `mock-${mockShares.length + 1}`,
      boxId,
      phoneNumber,
      code,
      status: "active",
      createdAt: createdAt.toISOString(),
    };
    mockShares.push(share);
    console.log("MOCK share aangemaakt:", share);
    return share;
  }

  // Production: Firestore
  const sharesRef = firestore.collection("shares");
  const shareDoc = sharesRef.doc(); // automatisch ID

  const payload = {
    boxId,
    phoneNumber,
    code,
    status: "active",
    createdAt,
  };

  await shareDoc.set(payload);

  return {
    id: shareDoc.id,
    ...payload,
    createdAt: createdAt.toISOString(),
  };
}

module.exports = {
  listBoxes,
  getBoxById,
  createShare,
};
