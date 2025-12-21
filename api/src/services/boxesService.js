// api/src/services/boxesService.js
import { db } from "../db.js";
import * as commandsService from "./commandsService.js";

function boxRefById(boxId) {
  return db.collection("boxes").doc(boxId);
}

/**
 * Zet Firestore document om naar exact wat de frontend nodig heeft.
 * Alles wat hier niet expliciet staat, bestaat niet voor de UI.
 */
function normalizeBox(id, data) {
  const d = data || {};

  return {
    id,

    // Identiteit
    site: d?.Portal?.Site ?? null,
    boxNumber: d?.Portal?.BoxNumber ?? null,

    // Status
    state: d?.status?.state ?? null,
    online: d?.status?.online ?? false,

    // UI gedrag
    hidden: d?.ui?.hidden ?? false,
    order: d?.ui?.order ?? 999
  };
}

/**
 * Alle boxen ophalen voor frontend
 */
export async function getAll() {
  const snap = await db.collection("boxes").get();
  return snap.docs
    .map(doc => normalizeBox(doc.id, doc.data()))
    .filter(box => box.hidden === false)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return (a.boxNumber ?? 0) - (b.boxNumber ?? 0);
    });
}

/**
 * Eén box ophalen
 */
export async function getById(boxId) {
  const snap = await boxRefById(boxId).get();
  if (!snap.exists) return null;
  return normalizeBox(snap.id, snap.data());
}

/**
 * OPEN command
 */
export async function openBox(boxId) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      status: {
        state: "pending",
        desired: "open",
        updatedAt: Date.now()
      }
    },
    { merge: true }
  );

  const cmd = await commandsService.createCommand({
    boxId,
    type: "open",
    source: "portal",
    payload: {}
  });

  return { success: true, commandId: cmd.id };
}

/**
 * CLOSE command
 */
export async function closeBox(boxId) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      status: {
        state: "pending",
        desired: "close",
        updatedAt: Date.now()
      }
    },
    { merge: true }
  );

  const cmd = await commandsService.createCommand({
    boxId,
    type: "close",
    source: "portal",
    payload: {}
  });

  return { success: true, commandId: cmd.id };
}
