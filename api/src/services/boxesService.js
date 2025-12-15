// api/src/services/boxesService.js

import { Firestore } from "@google-cloud/firestore";
import { getBox, listSharesForBox } from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;
const firestore = runningOnCloudRun ? new Firestore() : null;

/**
 * Lokale mock (enkel voor development)
 */
const localBoxes = [
  {
    id: "heist-1",
    status: { door: "closed", lock: "locked", online: true }
  },
  {
    id: "gbox-001",
    status: { door: "closed", lock: "locked", online: true }
  }
];

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
export async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }
  return [];
}

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(boxId) {
  if (!runningOnCloudRun) {
    return localBoxes.find(b => b.id === boxId) || null;
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
// OPEN
// ---------------------------------------------------------
export async function openBox(boxId, source = "api", phone = null) {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] OPEN ${boxId}`);
    return { success: true };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);
  const snap = await boxRef.get();

  if (!snap.exists) {
    return { success: false, message: "Box niet gevonden" };
  }

  // 1. Command voor device / simulator
  await boxRef.collection("commands").add({
    type: "OPEN",
    source,
    phone,
    createdAt: new Date().toISOString()
  });

  // 2. Platform-status vastzetten (leidend)
  await boxRef.set(
    {
      status: {
        door: "open",
        lock: "unlocked"
      },
      lifecycle: {
        state: "open",
        openedAt: new Date().toISOString(),
        openedBy: phone || "system"
      },
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return { success: true };
}

// ---------------------------------------------------------
// CLOSE
// ---------------------------------------------------------
export async function closeBox(boxId, source = "api", phone = null) {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] CLOSE ${boxId}`);
    return { success: true };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);
  const snap = await boxRef.get();

  if (!snap.exists) {
    return { success: false, message: "Box niet gevonden" };
  }

  // 1. Command voor device / simulator
  await boxRef.collection("commands").add({
    type: "CLOSE",
    source,
    phone,
    createdAt: new Date().toISOString()
  });

  // 2. Platform-status vastzetten
  await boxRef.set(
    {
      status: {
        door: "closed",
        lock: "locked"
      },
      lifecycle: {
        state: "closed",
        closedAt: new Date().toISOString(),
        closedBy: phone || "system"
      },
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return { success: true };
}
