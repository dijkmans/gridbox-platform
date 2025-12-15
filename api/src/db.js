// api/src/db.js

import { Firestore } from "@google-cloud/firestore";

// ----------------------------------------------------
// Detecteer Cloud Run
// ----------------------------------------------------
const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\s+/g, "").trim();
}

// ----------------------------------------------------
// Lokale mock data (enkel voor lokaal draaien)
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

// Alle actieve shares voor een box
export async function listSharesForBox(boxId) {
  if (!firestore) {
    return localShares.filter(
      (s) => s.boxId === boxId && s.active === true
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Nieuwe share aanmaken
export async function createShare({ boxId, phone }) {
  const share = {
    boxId,
    phone: normalizePhone(phone),
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (!firestore) {
    const local = {
      id: `mock-${localShares.length + 1}`,
      ...share,
    };
    localShares.push(local);
    return local;
  }

  const ref = await firestore.collection("shares").add(share);
  return { id: ref.id, ...share };
}

// Actieve share zoeken op box + phone
export async function findActiveShare(boxId, phone) {
  const normalized = normalizePhone(phone);

  if (!firestore) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          normalizePhone(s.phone) === normalized &&
          s.active === true
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .get();

  const match = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find(
      (s) => normalizePhone(s.phone) === normalized
    );

  return match || null;
}

// Actieve share zoeken op enkel phone (SMS-flow)
export async function findActiveShareByPhone(phone) {
  const normalized = normalizePhone(phone);

  if (!firestore) {
    return (
      localShares.find(
        (s) =>
          normalizePhone(s.phone) === normalized &&
          s.active === true
      ) || null
    );
  }

  console.log("🔎 SMS lookup for phone:", normalized);

  const snap = await firestore
    .collection("shares")
    .where("active", "==", true)
    .get();

  const match = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find(
      (s) => normalizePhone(s.phone) === normalized
    );

  if (!match) {
    console.log("❌ Geen actieve share gevonden");
    return null;
  }

  console.log("✅ Actieve share gevonden:", match.id);
  return match;
}
