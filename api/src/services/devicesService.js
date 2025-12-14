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
    // 1. Nieuwe structuur: devices/{boxId}
    const deviceSnap = await db.collection("devices").doc(boxId).get();

    if (deviceSnap.exists) {
      return {
        id: boxId,
        ...deviceSnap.data()
      };
    }

    // 2. Legacy fallback: boxes/{boxId}/config/config
    const legacyConfigSnap = await db
      .collection("boxes")
      .doc(boxId)
      .collection("config")
      .doc("config")
      .get();

    if (!legacyConfigSnap.exists) {
      return null;
    }

    return {
      id: boxId,
      ...legacyConfigSnap.data()
    };

  } catch (err) {
    console.error("Fout in getConfig:", err);
    throw err;
  }
}

/**
 * Sla statusinformatie van een Gridbox op.
 *
 * Path:
 * boxes/{boxId}/status
 *
 * Deze structuur blijft voorlopig bewust ongewijzigd,
 * omdat dashboards en monitoring hier al op steunen.
 */
export async function updateStatus(boxId, status) {
  try {
    await db
      .collection("boxes")
      .doc(boxId)
      .set(
        {
          status: {
            ...status,
            updatedAt: new Date()
          }
        },
        { merge: true }
      );
  } catch (err) {
    console.error("Fout in updateStatus:", err);
    throw err;
  }
}
