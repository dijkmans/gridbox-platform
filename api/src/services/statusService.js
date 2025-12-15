import { db } from "./firebase.js";

const ONLINE_TIMEOUT_SECONDS = 180; // 3 minuten

export async function getStatus(boxId) {
  const ref = db.collection("boxes").doc(boxId);
  const snap = await ref.get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data();
  const status = data.status || {};

  const lastSeen = status.lastSeen?.toDate?.();
  let online = false;

  if (lastSeen) {
    const now = new Date();
    const diffSeconds = (now - lastSeen) / 1000;
    online = diffSeconds < ONLINE_TIMEOUT_SECONDS;
  }

  return {
    ...status,
    online,
    lastSeen
  };
}
