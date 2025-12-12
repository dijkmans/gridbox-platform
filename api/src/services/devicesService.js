import { db } from "../firebase.js";

/**
 * Haal de configuratie op van één specifieke Gridbox.
 * Path in Firestore:
 * boxes/{boxId}/config
 */
export async function getConfig(boxId) {
  try {
    const docRef = db.collection("boxes").doc(boxId).collection("config").doc("config");
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: boxId,
      ...doc.data()
    };
  } catch (err) {
    console.error("Fout in getConfig:", err);
    throw err;
  }
}
