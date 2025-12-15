// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

// ----------------------------------------------------
// Firestore actief?
// ----------------------------------------------------
const useFirestore =
  !!process.env.K_SERVICE || !!process.env.FIRESTORE_EMULATOR_HOST;

let firestore = null;
if (useFirestore) {
  firestore = new Firestore();
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, "").trim();
}

function normalizeShare(id, data) {
  return {
    id,
    boxId: data.boxId || data.boxid || null,
    phone: data.phone || data.phoneNumber || null,
    active: data.active === true,
    createdAt: data.createdAt || null
  };
}

// ----------------------------------------------------
// Lokale mock data (alleen lokaal)
// ----------------------------------------------------
const localBoxes = new Map([
  [
    "gbox-001",
    {
      id: "gbox-001",
      locationName: "Simulator",
      number: 1,
      status: "online",
      description: "Gridbox 001 (lokale mock)",
      cameraEnabled: false
    }
  ]
]);

const localShares = [];

// ----------------------------------------------------
// BOXES
// ----------------------------------------------------
export async function getBox(boxId) {
  if (!firestore) {
    return localBoxes.get(boxId) || null;
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
    return localShares.filter(
      (s) => s.boxId === boxId && s.active === true
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .get();

  return snap.docs.map((d) => normalizeShare(d.id, d.data()));
}

export async function createShare({ boxId, phone }) {
  const phoneN = normalizePhone(phone);

  const share = {
    boxId,
    phone: phoneN,
    phoneNumber: phoneN,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (!firestore) {
    const local = { id: `mock-${localShares.length + 1}`, ...share };
    localShares.push(local);
    return local;
  }

  const ref = await firestore.collection("shares").add(share);
  return { id: ref.id, ...share };
}

// ⚠️ DEZE EXPORT IS CRUCIAAL
export async function findActiveShare(boxId, phone) {
  const phoneN = normalizePhone(phone);

  if (!firestore) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          s.phone === phoneN &&
          s.active === true
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phone", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return normalizeShare(snap.docs[0].id, snap.docs[0].data());
}

export async function findActiveShareByPhone(phone) {
  const phoneN = normalizePhone(phone);

  if (!firestore) {
    return (
      localShares.find(
        (s) => s.phone === phoneN && s.active === true
      ) || null
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("phone", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return normalizeShare(snap.docs[0].id, snap.docs[0].data());
}
