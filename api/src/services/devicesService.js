import { db } from "./firebase.js";
import { Timestamp } from "firebase-admin/firestore";

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

/**
 * Markeer een command als uitgevoerd (done).
 * Path:
 * boxes/{boxId}/commands/{commandId}
 */
export async function markCommandDone(boxId, commandId, options = {}) {
  try {
    const { result = "ok", payload = null, error = null } = options || {};

    const ref = db
      .collection("boxes")
      .doc(boxId)
      .collection("commands")
      .doc(commandId);

    const update = {
      status: "done",
      result,
      executedAt: Timestamp.now()
    };

    if (payload !== null && payload !== undefined) {
      update.payload = payload;
    }

    if (error !== null && error !== undefined) {
      update.error = error;
    }

    await ref.set(update, { merge: true });
  } catch (err) {
    console.error("Fout in markCommandDone:", err);
    throw err;
  }
}

/**
 * Voeg een event toe voor een Gridbox.
 * Path:
 * boxes/{boxId}/events
 */
export async function addEvent(boxId, options = {}) {
  try {
    const { type, payload = {}, timestamp = null, source = "device" } = options || {};

    if (!type) {
      throw new Error("Event type ontbreekt");
    }

    const event = {
      type,
      source,
      payload,
      createdAt: Timestamp.now()
    };

    if (timestamp) {
      event.clientTimestamp = timestamp;
    }

    await db
      .collection("boxes")
      .doc(boxId)
      .collection("events")
      .add(event);
  } catch (err) {
    console.error("Fout in addEvent:", err);
    throw err;
  }
}
