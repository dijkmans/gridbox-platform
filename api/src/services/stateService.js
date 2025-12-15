// api/src/services/stateService.js

import { db } from "../firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export async function updateState(boxId, nextState) {
  const ref = db.collection("boxes").doc(boxId);

  await ref.update({
    state: {
      ...nextState,
      since: Timestamp.now()
    }
  });
}

export async function getState(boxId) {
  const snap = await db.collection("boxes").doc(boxId).get();
  return snap.exists ? snap.data().state : null;
}
