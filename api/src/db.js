// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

// Detecteer Cloud Run
const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

// ----------------------------------------------------
// Lokale mock data (enkel lokaal)
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
// Helpers
// ----------------------------------------------------
function isActiveShare(s) {
  if (!s) return false;
  if (s.active === true) return true;
  if (s.active === "true") return true; // als iemand per ongeluk string heeft opgeslagen
  if (s.status === "active") return true; // legacy
  return false;
}

function normalizeShare(raw) {
  return {
    ...raw,
    boxId: raw.boxId || raw.boxid || null,
    phone: raw.phone || raw.phoneNumber || null,
  };
}

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
    return localShares
      .map(normalizeShare)
      .filter((s) => s.boxId === boxId && isActiveShare(s));
  }

  const snap = await firestore
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
    createdAt: new Date().toISOString(),
  };

  if (!firestore) {
    const local = { id: `mock-${localShares.length + 1}`, ...share };
    localShares.push(local);
    return local;
  }

  const ref = await firestore.collection("shares").add(share);
  return { id: ref.id, ...share };
}

export async function findActiveShare(boxId, phone) {
  if (!firestore) {
    return (
      localShares
        .map(normalizeShare)
        .find((s) => s.boxId === boxId && s.phone === phone && isActiveShare(s)) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phone", "==", phone)
    .limit(10)
    .get();

  const matches = snap.docs
    .map((d) => normalizeShare({ id: d.id, ...d.data() }))
    .filter((s) => isActiveShare(s));

  if (matches.length > 0) return matches[0];

  // fallback voor phoneNumber legacy
  const snap2 = await firestore
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
  if (!firestore) {
    return (
      localShares
        .map(normalizeShare)
        .find((s) => s.phone === phone && isActiveShare(s)) || null
    );
  }

  // Eerst proper: phone + active true
  const snap1 = await firestore
    .collection("shares")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap1.empty) {
    const d = snap1.docs[0];
    return normalizeShare({ id: d.id, ...d.data() });
  }

  // Fallback: phoneNumber + active true
  const snap2 = await firestore
    .collection("shares")
    .where("phoneNumber", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap2.empty) {
    const d = snap2.docs[0];
    return normalizeShare({ id: d.id, ...d.data() });
  }

  // Fallback legacy: status == "active"
  const snap3 = await firestore
    .collection("shares")
    .where("phone", "==", phone)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!snap3.empty) {
    const d = snap3.docs[0];
    return normalizeShare({ id: d.id, ...d.data() });
  }

  const snap4 = await firestore
    .collection("shares")
    .where("phoneNumber", "==", phone)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!snap4.empty) {
    const d = snap4.docs[0];
    return normalizeShare({ id: d.id, ...d.data() });
  }

  return null;
}
