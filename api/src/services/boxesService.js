// api/src/services/boxesService.js

import { getBox } from "../db.js";
import { Firestore } from "@google-cloud/firestore";

const firestore = process.env.K_SERVICE ? new Firestore() : null;

// box openen
export async function openBox(boxId) {
  if (!firestore) {
    return { success: true, simulated: true };
  }

  const ref = firestore.collection("boxes").doc(boxId);

  const snap = await ref.get();
  if (!snap.exists) {
    return { success: false, message: "Box niet gevonden" };
  }

  await ref.update({
    "status.door": "open",
    "status.lock": "unlocked",
    "status.timestamp": new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return { success: true };
}
