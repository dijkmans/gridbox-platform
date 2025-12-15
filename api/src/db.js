// api/src/db.js

import { Firestore } from "@google-cloud/firestore";

const useFirestore =
  !!process.env.K_SERVICE || !!process.env.FIRESTORE_EMULATOR_HOST;

let firestore = null;
if (useFirestore) {
  firestore = new Firestore();
}

// helpers
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/\s+/g, "").trim();
}

// lokale mock (alleen lokaal)
const localShares = [];

// shares per box
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

// share aanmaken
export async function createShare({ boxId, phone }) {
  const phoneN = normalizePhone(phone);

  const share = {
    boxId,
    phone: phoneN,
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

// actieve share box + phone
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
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ✅ DIT IS CRUCIAAL VOOR SMS
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
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
