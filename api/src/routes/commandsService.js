import { db } from "../lib/firestore.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Haal alle openstaande (pending) commands op voor een box
 */
export async function getPendingCommands(boxId) {
  const snapshot = await db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .get();

  const commands = [];

  snapshot.forEach(doc => {
    commands.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return commands;
}

/**
 * Bevestig dat een command uitgevoerd is
 */
export async function ackCommand(boxId, commandId, result = "ok") {
  const ref = db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .doc(commandId);

  await ref.update({
    status: "done",
    result,
    executedAt: Timestamp.now()
  });
}
