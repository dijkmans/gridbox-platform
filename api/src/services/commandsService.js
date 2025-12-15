import { db } from "./firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export async function getPendingCommands(boxId) {
  // Let op: in Firestore kan een where + orderBy op 2 velden een index vereisen.
  // We proberen gesorteerd, maar vallen terug naar een simpele query als dat faalt.
  let snapshot;

  try {
    snapshot = await db
      .collection("boxes")
      .doc(boxId)
      .collection("commands")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .get();
  } catch (err) {
    console.warn(
      "⚠️ getPendingCommands: orderBy query faalde (mogelijk index). Fallback zonder orderBy.",
      err.message
    );

    snapshot = await db
      .collection("boxes")
      .doc(boxId)
      .collection("commands")
      .where("status", "==", "pending")
      .get();
  }

  const commands = [];

  snapshot.forEach(doc => {
    commands.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return commands;
}

export async function ackCommand(boxId, commandId, result = "ok") {
  const ref = db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .doc(commandId);

  await ref.set(
    {
      status: "done",
      result,
      executedAt: Timestamp.now()
    },
    { merge: true }
  );
}
