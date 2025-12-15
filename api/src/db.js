// api/src/db.js

import { Firestore } from "@google-cloud/firestore";

// Detecteer Cloud Run (Firestore actief) of lokale dev-mode
const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

// ----------------------------------------------------
// Lokale mock data
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

export async function createShare({ boxId, phone }) {
  const base = {
    boxId,
    phone,
    active: true,
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

// ----------------------------------------------------
// Actieve share zoeken (box + phone)
// ----------------------------------------------------
export async function findActiveShare(boxId, phone) {
  if (!firestore) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          s.phone === phone &&
          s.active === true
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}
