// api/src/services/boxesService.js

import { Firestore } from "@google-cloud/firestore";
import { getBox } from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;
const firestore = runningOnCloudRun ? new Firestore() : null;

/**
 * Lokale mock (enkel voor development)
 */
const localBoxes = [
  {
    id: "gbox-001",
    lifecycle: {
      state: "closed"
    },
    status: {
      door: "closed",
      lock: "locked",
      online: true
    }
  }
];

// ---------------------------------------------------------
// Alle boxen ophalen
// ---------------------------------------------------------
export async function getAll() {
  if (!runningOnCloudRun) {
    return localBoxes;
  }

  // later uitbreidbaar
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
// OPEN
// ---------------------------------------------------------
export async function openBox(boxId, source = "api", requestedBy = "system") {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] OPEN ${boxId}`);
    return { success: true };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);
  const snap = await boxRef.get();

  if (!snap.exists) {
    return { success: false, message: "Box niet gevonden" };
  }

  const nowIso = new Date().toISOString();

  // 1. Lifecycle is LEIDEND
  await boxRef.set(
    {
      lifecycle: {
        state: "open",
        openedAt: nowIso,
        openedBy: requestedBy,
        source
      },
      updatedAt: nowIso
    },
    { merge: true }
  );

  // 2. Command voor hardware / simulator
  await boxRef.collection("commands").add({
    type: "OPEN",
    status: "pending",
    source,
    requestedBy,
    createdAt: new Date(),
    requestedAt: nowIso
  });

  return { success: true };
}

// ---------------------------------------------------------
// CLOSE
// ---------------------------------------------------------
export async function closeBox(boxId, source = "api", requestedBy = "system") {
  if (!runningOnCloudRun) {
    console.log(`🧪 [LOCAL] CLOSE ${boxId}`);
    return { success: true };
  }

  const boxRef = firestore.collection("boxes").doc(boxId);
  const snap = await boxRef.get();

  if (!snap.exists) {
    return { success: false, message: "Box niet gevonden" };
  }

  const nowIso = new Date().toISOString();

  // 1. Lifecycle is LEIDEND
  await boxRef.set(
    {
      lifecycle: {
        state: "closed",
        closedAt: nowIso,
        closedBy: requestedBy,
        source
      },
      updatedAt: nowIso
    },
    { merge: true }
  );

  // 2. Command voor hardware / simulator
  await boxRef.collection("commands").add({
    type: "CLOSE",
    status: "pending",
    source,
    requestedBy,
    createdAt: new Date(),
    requestedAt: nowIso
  });

  return { success: true };
}
