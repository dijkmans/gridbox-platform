// api/src/services/boxesService.js
import { Firestore } from "@google-cloud/firestore";
import { getBox, listSharesForBox } from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

// lokale mock (enkel lokaal)
const localBoxes = [
  { id: "heist-1", status: "online" },
  { id: "gbox-001", status: "online" },
];

// ---------------------------------------------------------
// Alle boxen ophalen (optioneel)
// ---------------------------------------------------------
export async function getAll() {
  return localBoxes;
}

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(id) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === id) || null;
  }
  return await getBox(id);
}

// ---------------------------------------------------------
// Shares voor box ophalen
// ---------------------------------------------------------
export async function getShares(boxId) {
  return await listSharesForBox(boxId);
}

// ---------------------------------------------------------
// Box openen (SMS gebruikt dit)
// ---------------------------------------------------------
export async function openBox(boxId) {
  if (!runningOnCloudRun) {
    const box = localBoxes.find((b) => b.id === boxId);
    if (!box) return { success: false, message: `Box ${boxId} niet gevonden (lokaal)` };

    box.status = "open";
    return { success: true, message: `Mock: box ${boxId} is geopend` };
  }

  // check box bestaat
  const box = await getBox(boxId);
  if (!box) {
    return { success: false, message: `Box ${boxId} niet gevonden (Firestore)` };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);

  // command in subcollection
  await boxRef.collection("commands").add({
    type: "OPEN",
    source: "sms",
    createdAt: new Date().toISOString(),
  });

  // optioneel status update
  await boxRef.set(
    {
      status: {
        ...(box.status || {}),
        door: "open",
        lock: "unlocked",
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { success: true, message: "OPEN command aangemaakt" };
}
