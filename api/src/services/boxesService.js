// api/src/services/boxesService.js
import { db } from "../db.js";
import * as commandsService from "./commandsService.js";

function boxRefById(boxId) {
  return db.collection("boxes").doc(boxId);
}

/**
 * Zet Firestore document om naar exact wat frontend en agent nodig hebben.
 * Alles wat hier niet expliciet staat, bestaat niet.
 */
function normalizeBox(id, data) {
  const d = data || {};

  return {
    id,

    // Identiteit
    site: d?.Portal?.Site ?? null,
    boxNumber: d?.Portal?.BoxNumber ?? null,
    customer: d?.Portal?.Customer ?? null,

    // Box configuratie en gewenste toestand
    box: {
      number: d?.box?.number ?? null,
      type: d?.box?.type ?? null,
      description: d?.box?.description ?? null,

      desired: d?.box?.desired ?? null,
      desiredAt: d?.box?.desiredAt ?? null,
      desiredBy: d?.box?.desiredBy ?? null
    },

    // Status (feedback van agent)
    status: {
      state: d?.status?.state ?? null,
      doorState: d?.status?.doorState ?? null,
      online: d?.status?.online ?? false,
      updatedAt: d?.status?.updatedAt ?? null
    },

    // UI gedrag
    ui: {
      hidden: d?.ui?.hidden ?? false,
      order: d?.ui?.order ?? 999
    }
  };
}

/**
 * Alle boxen ophalen
 */
export async function getAll() {
  const snap = await db.collection("boxes").get();

  return snap.docs
    .map(doc => normalizeBox(doc.id, doc.data()))
    .filter(box => box.ui.hidden === false)
    .sort((a, b) => {
      if (a.ui.order !== b.ui.order) return a.ui.order - b.ui.order;
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
 * OPEN box
 * Zet desired state en registreert command
 */
export async function openBox(boxId) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      box: {
        desired: "open",
        desiredAt: Date.now(),
        desiredBy: "portal"
      },
      status: {
        state: "pending"
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
 * CLOSE box
 * Zet desired state en registreert command
 */
export async function closeBox(boxId) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      box: {
        desired: "close",
        desiredAt: Date.now(),
        desiredBy: "portal"
      },
      status: {
        state: "pending"
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
