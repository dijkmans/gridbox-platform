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

  const snap = await firestore.collection("shares").get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (s) =>
        (s.boxId === boxId || s.boxid === boxId) &&
        s.active === true
    );
}

export async function createShare({ boxId, phone }) {
  const base = {
    boxId,          // altijd correct veld gebruiken
    phone,
    active: true,
    createdAt: new Date().toISOString(),
  };

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
          s.phone === phone &&
          s.active === true &&
          (s.boxId === boxId || s.boxid === boxId)
      ) || null
    );
  }

  const snap = await firestore.collection("shares").get();

  const matches = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (s) =>
        s.active === true &&
        s.phone === phone &&
        (s.boxId === boxId || s.boxid === boxId)
    );

  return matches[0] || null;
}

// ----------------------------------------------------
// Actieve share zoeken op enkel phone (SMS)
// ----------------------------------------------------
export async function findActiveShareByPhone(phone) {
  if (!firestore) {
    return (
      localShares.find(
        (s) => s.phone === phone && s.active === true
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}
