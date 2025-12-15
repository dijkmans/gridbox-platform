// api/src/db.js
import { Firestore } from "@google-cloud/firestore";

const runningOnCloudRun = !!process.env.K_SERVICE;
let firestore = runningOnCloudRun ? new Firestore() : null;

// ----------------------------
// Helpers
// ----------------------------
function normalizeShare(raw) {
  return {
    ...raw,
    boxId: raw.boxId || raw.boxid || null,
    phone: raw.phone || raw.phoneNumber || null
  };
}

function isActiveShare(s) {
  return s && (s.active === true || s.status === "active");
}

// ----------------------------
// SHARES
// ----------------------------
export async function listSharesForBox(boxId) {
  if (!firestore) return [];

  const snap = await firestore
    .collection("shares")
    .where("boxId", "==", boxId)
    .get();

  return snap.docs
    .map(d => normalizeShare({ id: d.id, ...d.data() }))
    .filter(isActiveShare);
}

export async function createShare({ boxId, phone }) {
  const share = {
    boxId,
    phone,
    active: true,
    createdAt: new Date().toISOString()
  };

  const ref = await firestore.collection("shares").add(share);
  return { id: ref.id, ...share };
}

export async function findActiveShareByPhone(phone) {
  if (!firestore) return null;

  const snap = await firestore
    .collection("shares")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snap.empty) {
    return normalizeShare({ id: snap.docs[0].id, ...snap.docs[0].data() });
  }

  return null;
}
