// src/shares.js
const db = require("./db");

let mockShares = [];

// eenvoudige 6-cijferige code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildShare(boxId, phoneNumber) {
  return {
    boxId,
    phoneNumber,
    code: generateCode(),
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

// nieuwe share aanmaken
async function createShare(boxId, phoneNumber) {
  const base = buildShare(boxId, phoneNumber);

  // eerst Firestore proberen
  if (db && typeof db.collection === "function") {
    try {
      const docRef = await db.collection("shares").add(base);
      return { id: docRef.id, ...base };
    } catch (err) {
      console.error(
        "Fout bij opslaan share in Firestore, val terug op mock:",
        err.message
      );
    }
  } else {
    console.warn(
      "Geen Firestore client gevonden, gebruik in-memory mock voor shares"
    );
  }

  // fallback voor lokaal ontwikkelen
  const mockId = `mock-${mockShares.length + 1}`;
  const share = { id: mockId, ...base };
  mockShares.push(share);
  return share;
}

// alle shares voor één box ophalen
async function getSharesForBox(boxId) {
  // echte Firestore
  if (db && typeof db.collection === "function") {
    try {
      const snapshot = await db
        .collection("shares")
        .where("boxId", "==", boxId)
        .get();

      const shares = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // nieuwste eerst
      shares.sort((a, b) => {
        const aDate = a.createdAt || "";
        const bDate = b.createdAt || "";
        return bDate.localeCompare(aDate);
      });

      return shares;
    } catch (err) {
      console.error(
        "Fout bij lezen shares uit Firestore, val terug op mock:",
        err.message
      );
    }
  }

  // mock data
  return mockShares
    .filter((s) => s.boxId === boxId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// checken of een share bestaat voor box + gsm (code is optioneel)
async function verifyShare(boxId, phoneNumber, code) {
  // Firestore
  if (db && typeof db.collection === "function") {
    try {
      const snapshot = await db
        .collection("shares")
        .where("boxId", "==", boxId)
        .get();

      const shares = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const match = shares.find(
        (s) =>
          s.status === "active" &&
          s.phoneNumber === phoneNumber &&
          (!code || s.code === code)
      );

      if (match) {
        return { valid: true, share: match };
      }

      return { valid: false };
    } catch (err) {
      console.error(
        "Fout bij verifyShare in Firestore, val terug op mock:",
        err.message
      );
    }
  }

  // mock fallback
  const match = mockShares.find(
    (s) =>
      s.boxId === boxId &&
      s.status === "active" &&
      s.phoneNumber === phoneNumber &&
      (!code || s.code === code)
  );

  if (match) {
    return { valid: true, share: match };
  }

  return { valid: false };
}

module.exports = {
  createShare,
  getSharesForBox,
  verifyShare,
};


