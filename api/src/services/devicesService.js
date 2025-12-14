import { db } from "../firebase.js";

/**
 * Haal de configuratie op van één specifieke Gridbox.
 *
 * Volgorde:
 * 1. devices/{boxId}
 * 2. TEMP fallback: boxes/{boxId}/config/config
 *
 * TODO: fallback verwijderen na volledige migratie naar 'devices'
 */
export async function getConfig(boxId) {
  try {
    // 1. NIEUWE structuur: devices/{boxId}
    let docSnap = await db.collection("devices").doc(boxId).get();

    if (docSnap.exists) {
      return {
        id: boxId,
        ...docSnap.data()
      };
    }

    // 2. TEMP fallback: legacy structuur boxes/{boxId}/config/config
    const legacyRef = db
      .collection("boxes")
      .doc(boxId)
      .collection("config")
      .doc("config");

    const legacyDoc = await legacyRef.get();

    if (!legacyDoc.exists) {
      return null;
    }

    return {
      id: boxId,
      ...legacyDoc.data()
    };

  } catch (err) {
    console.error("Fout in getConfig:", err);
    throw err;
  }
}
