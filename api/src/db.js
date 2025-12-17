// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

// Cloud Run detectie
const runningOnCloudRun = !!process.env.K_SERVICE;

// Gebruik Firestore als we op Cloud Run zitten of als de emulator actief is
const useFirestore = runningOnCloudRun || !!process.env.FIRESTORE_EMULATOR_HOST;

// Named export die andere files kunnen importeren
export let db = null;

if (useFirestore) {
  db = new Firestore();
}

// ----------------------------------------------------
// Lokale mock data (enkel lokaal, Cloud Run of emulator gebruikt Firestore)
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
      cameraEnabled: true
    }
  ]
]);

const localShares = [];

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function isActiveShare(s) {
  if (!s) return false;
  if (s.active === true) return true;
  if (s.active === "true") return true; // legacy fout
  if (s.status === "active") return true; // legacy
  return false;
}

function normalizeShare(raw) {
  const boxId = raw.boxId || raw.boxid || null;
  const phone = raw.phone || raw.phoneNumber || null;

  return {
    ...raw,
    boxId,
    phone
  };
}

// ----------------------------------------------------
// BOXES
// ----------------------------------------------------
export async function getBox(boxId) {
  if (!db) {
    const box = localBoxes.get(boxId);
    return box ? { ...box } : null;
  }

  const doc = await db.collection("boxes").doc(boxId).get();
  if (!doc.exists) return null;

  return { id: doc.id, ...doc.data() };
}

// ----------------------------------------------------
// SHARES
// ----------------------------------------------------
export async function listSharesForBox(boxId) {
  if (!db) {
    return localShares
      .map((s) => normalizeShare(s))
      .filter((s) => s.boxId === boxId && isActiveShare(s));
  }

  const snap = await db
    .collection("shares")
    .where("boxId", "==", boxId)
    .limit(50)
    .get();

  return snap.docs
    .map((d) => normalizeShare({ id: d.id, ...d.data() }))
    .filter((s) => isActiveShare(s));
}

export async function createShare({ boxId, phone }) {
  const share = {
    boxId,
    phone,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (!db) {
    const local = { id: `mock-${localShares.length + 1}`, ...share };
    localShares.push(local);
    return local;
  }

  const ref = await db.collection("shares").add(share);
  return { id: ref.id, ...share };
}

export async function findActiveShare(boxId, phone) {
  if (!db) {
    return (
      localShares
        .map((s) => normalizeShare(s))
        .find((s) => s.boxId === boxId && s.phone === phone && isActiveShare(s)) ||
      null
    );
  }

  const snap = await db
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phone", "==", phone)
    .limit(10)
    .get();

  const matches = snap.docs
    .map((d) => normalizeShare({ id: d.id, ...d.data() }))
    .filter((s) => isActiveShare(s));

  if (matches.length > 0) return matches[0];

  // fallback: oude veldnaam phoneNumber
  const snap2 = await db
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phoneNumber", "==", phone)
    .limit(10)
    .get();

  const matches2 = snap2.docs
    .map((d) => normalizeShare({ id: d.id, ...d.data() }))
    .filter((s) => isActiveShare(s));

  return matches2[0] || null;
}

export async function findActiveShareByPhone(phone) {
  if (!db) {
    return (
      localShares
        .map((s) => normalizeShare(s))
        .find((s) => s.phone === phone && isActiveShare(s)) || null
    );
  }

  const results = [];

  const snap1 = await db
    .collection("shares")
    .where("phone", "==", phone)
    .limit(20)
    .get();

  snap1.docs.forEach((d) => results.push(normalizeShare({ id: d.id, ...d.data() })));

  const snap2 = await db
    .collection("shares")
    .where("phoneNumber", "==", phone)
    .limit(20)
    .get();

  snap2.docs.forEach((d) => results.push(normalizeShare({ id: d.id, ...d.data() })));

  const active = results.filter((s) => isActiveShare(s));
  return active[0] || null;
}
