// api/src/services/boxesService.js

import { Firestore } from "@google-cloud/firestore";
import { getBox, listSharesForBox } from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

let firestore = null;
if (runningOnCloudRun) {
  firestore = new Firestore();
}

/**
 * Lokale mock (enkel voor development zonder Cloud Run)
 */
const localBoxes = [
  { id: "heist-1", status: { online: true } },
  { id: "gbox-001", status: { online: true } },
];

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
export async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }

  // optioneel later: Firestore query
  return [];
}

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(boxId) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === boxId) || null;
  }

  return await getBox(boxId);
}

// ---------------------------------------------------------
// Shares voor box ophalen
// ---------------------------------------------------------
export async function getShares(boxId) {
  return await listSharesForBox(boxId);
}

// ---------------------------------------------------------
// OPEN command sturen naar box
// ---------------------------------------------------------
export async function openBox(boxId, source = "api") {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] OPEN command voor ${boxId}`);
    return { success: true, message: "Mock OPEN uitgevoerd" };
  }

  const box = await getBox(boxId);
  if (!box) {
    return {
      success: false,
      message: `Box ${boxId} niet gevonden`
    };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);

  await boxRef.collection("commands").add({
    type: "OPEN",
    source,
    createdAt: new Date().toISOString()
  });

  return {
    success: true,
    message: "OPEN command aangemaakt"
  };
}

// ---------------------------------------------------------
// CLOSE command sturen naar box
// ---------------------------------------------------------
export async function closeBox(boxId, source = "api") {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] CLOSE command voor ${boxId}`);
    return { success: true, message: "Mock CLOSE uitgevoerd" };
  }

  const box = await getBox(boxId);
  if (!box) {
    return {
      success: false,
      message: `Box ${boxId} niet gevonden`
    };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);

  await boxRef.collection("commands").add({
    type: "CLOSE",
    source,
    createdAt: new Date().toISOString()
  });

  return {
    success: true,
    message: "CLOSE command aangemaakt"
  };
}
