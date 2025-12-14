import { db } from "../firebase.js";

/**
 * Haal de configuratie op van één specifieke Gridbox.
 * Path:
 * boxes/{boxId}
 */
export async function getConfig(boxId) {
  try {
    const docRef = db.collection("boxes").doc(boxId);
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

/**
 * Update de status van een Gridbox.
 * Path:
 * boxes/{boxId}
 */
export async function updateStatus(boxId, status) {
  try {
    const statusData = {
      ...status,
      updatedAt: new Date()
    };

    await db
      .collection("boxes")
      .doc(boxId)
      .set(
        {
          status: statusData
        },
        { merge: true }
      );
  } catch (err) {
    console.error("Fout in updateStatus:", err);
    throw err;
  }
}

/**
 * Voeg een command toe aan een Gridbox.
 * Path:
 * boxes/{boxId}/commands
 */
export async function addCommand(boxId, command) {
  try {
    await db
      .collection("boxes")
      .doc(boxId)
      .collection("commands")
      .add(command);
  } catch (err) {
    console.error("Fout in addCommand:", err);
    throw err;
  }
}

/**
 * Haal alle pending commands op voor een Gridbox.
 * Path:
 * boxes/{boxId}/commands
 */
export async function getPendingCommands(boxId) {
  try {
    const snapshot = await db
      .collection("boxes")
      .doc(boxId)
      .collection("commands")
      .where("status", "==", "pending")
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error("Fout in getPendingCommands:", err);
    throw err;
  }
}
