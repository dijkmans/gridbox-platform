// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

// ----------------------------------------------------
// Firestore aan of uit
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
function normPhone(number) {
  if (!number) return null;
  return String(number).replace(/\s+/g, "").trim();
}

function normalizeShareDoc(id, data) {
  return {
    id,
    ...data,
    boxId: data.boxId || data.boxid || null,
    phone: data.phone || data.phoneNumber || null
  };
}

// ----------------------------------------------------
// Lokale mock data (enkel lokaal)
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
    return localShares.filter(
      (s) => s.boxId === boxId && s.active === true
    );
  }

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .get();

  return snap.docs.map((d) => normalizeShareDoc(d.id, d.data()));
}

export async function createShare({ boxId, phone }) {
  const phoneN = normPhone(phone);

  const base = {
    boxId,
    phone: phoneN,
    phoneNumber: phoneN,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (!firestore) {
    const share = { id: `mock-${localShares.length + 1}`, ...base };
    localShares.push(share);
    return share;
  }

  const ref = await firestore.collection("shares").add(base);
  return { id: ref.id, ...base };
}

// 🔴 DEZE EXPORT MOET BESTAAN
export async function findActiveShare(boxId, phone) {
  const phoneN = normPhone(phone);

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

  const doc = snap.docs[0];
  return normalizeShareDoc(doc.id, doc.data());
}

export async function findActiveShareByPhone(phone) {
  const phoneN = normPhone(phone);

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

  const doc = snap.docs[0];
  return normalizeShareDoc(doc.id, doc.data());
}
