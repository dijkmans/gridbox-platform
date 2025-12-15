// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

// ----------------------------------------------------
// Firestore aan of uit
// ----------------------------------------------------
// Cloud Run zet K_SERVICE. Lokaal kan je ook de emulator gebruiken via FIRESTORE_EMULATOR_HOST.
const useFirestore = !!process.env.K_SERVICE || !!process.env.FIRESTORE_EMULATOR_HOST;

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
  const boxId = data.boxId || data.boxid || null;
  const phone = data.phone || data.phoneNumber || null;

  return {
    id,
    ...data,
    boxId,
    phone,
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
      cameraEnabled: false,
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
    return localShares.filter((s) => s.boxId === boxId && s.active === true);
  }

  // Primair: boxId
  const snap1 = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("active", "==", true)
    .get();

  const res1 = snap1.docs.map((d) => normalizeShareDoc(d.id, d.data()));
  if (res1.length > 0) return res1;

  // Fallback: boxid (oude veldnaam)
  const snap2 = await firestore
    .collection("shares")
    .where("boxid", "==", boxId)
    .where("active", "==", true)
    .get();

  return snap2.docs.map((d) => normalizeShareDoc(d.id, d.data()));
}

export async function createShare({ boxId, phone }) {
  const phoneN = normPhone(phone);

  const base = {
    boxId,
    phone: phoneN,
    phoneNumber: phoneN, // handig voor oudere code
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (!firestore) {
    const share = { id: `mock-${localShares.length + 1}`, ...base };
    localShares.push(share);
    return share;
  }

  const ref = await firestore.collection("shares").add(base);
  return { id: ref.id, ...base };
}

export async function findActiveShare(boxId, phone) {
  const phoneN = normPhone(phone);

  if (!firestore) {
    return (
      localShares.find(
        (s) => s.boxId === boxId && s.phone === phoneN && s.active === true
      ) || null
    );
  }

  // Primair: boxId + phone
  const snap1 = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phone", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap1.empty) {
    const doc = snap1.docs[0];
    return normalizeShareDoc(doc.id, doc.data());
  }

  // Fallback: boxId + phoneNumber
  const snap2 = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .where("phoneNumber", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap2.empty) {
    const doc = snap2.docs[0];
    return normalizeShareDoc(doc.id, doc.data());
  }

  // Fallback: boxid + phone
  const snap3 = await firestore
    .collection("shares")
    .where("boxid", "==", boxId)
    .where("phone", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap3.empty) {
    const doc = snap3.docs[0];
    return normalizeShareDoc(doc.id, doc.data());
  }

  return null;
}

export async function findActiveShareByPhone(phone) {
  const phoneN = normPhone(phone);

  if (!firestore) {
    return (
      localShares.find((s) => s.phone === phoneN && s.active === true) || null
    );
  }

  // Primair: phone
  const snap1 = await firestore
    .collection("shares")
    .where("phone", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap1.empty) {
    const doc = snap1.docs[0];
    return normalizeShareDoc(doc.id, doc.data());
  }

  // Fallback: phoneNumber
  const snap2 = await firestore
    .collection("shares")
    .where("phoneNumber", "==", phoneN)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (snap2.empty) return null;

  const doc = snap2.docs[0];
  return normalizeShareDoc(doc.id, doc.data());
}
