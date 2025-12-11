// api/src/db.js

import { Firestore } from "@google-cloud/firestore";

// Detecteer Cloud Run (Firestone actief) of lokale dev-mode (mock data)
const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

// ----------------------------------------------------
// Lokale mock tables voor ontwikkeling
// ----------------------------------------------------
const localBoxes = new Map([
  [
    "heist-1",
    {
      id: "heist-1",
      locationName: "Heist",
      number: 1,
      status: "online",
      description: "Gridbox Heist #1 (lokale mock)",
      cameraEnabled: true,
    },
  ],
]);

const localShares = [];

// ----------------------------------------------------
// BOXES
// ----------------------------------------------------
export async function getBox(boxId) {
  if (!firestore) {
    const box = localBoxes.get(boxId);
    return box ? { ...box } : null;
  }

  const doc = await firestore.collection("boxes").doc(boxId).get();
  if (!doc.exists) return null;

  return { id: doc.id, ...doc.data() };
}

// ----------------------------------------------------
// SHARES
// ----------------------------------------------------
export async function listSharesForBox(boxId) {
  if (!firestore) {
    return localShares.filter((s) => s.boxId === boxId);
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createShare({ boxId, phoneNumber, code }) {
  const base = {
    boxId,
    phoneNumber,
    code,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  // Lokale mock
  if (!firestore) {
    const share = {
      id: `mock-${localShares.length + 1}`,
      ...base,
    };
    localShares.push(share);
    return share;
  }

  const ref = await firestore.collection("shares").add(base);
  return { id: ref.id, ...base };
}

export async function findActiveShare(boxId, phoneNumber) {
  // Lokale mock
  if (!firestore) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          s.phoneNumber === phoneNumber &&
          s.status === "active"
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phoneNumber", "==", phoneNumber)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}
