// api/src/services/boxesService.js
import { db } from "../db.js";
import * as commandsService from "./commandsService.js";

function nowMs() {
  return Date.now();
}

function boxRefById(boxId) {
  // legacy: boxes/{boxId}
  return db.collection("boxes").doc(boxId);
}

export async function getById(boxId) {
  const snap = await boxRefById(boxId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Open en Close zetten box status op pending,
 * en maken een command aan met deadline en retries.
 * Box status wordt pas "open/closed" als device result ok is (zie orgBoxDevice route).
 */
export async function openBox(boxId, source = "api", requestedBy = null) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      status: {
        state: "pending",
        desired: "open",
        updatedAt: nowMs(),
        lastError: null
      }
    },
    { merge: true }
  );

  const cmd = await commandsService.createCommand({
    boxId,
    type: "open",
    source,
    requestedBy,
    payload: {}
  });

  return { success: true, commandId: cmd.id };
}

export async function closeBox(boxId, source = "api", requestedBy = null) {
  const ref = boxRefById(boxId);

  await ref.set(
    {
      status: {
        state: "pending",
        desired: "close",
        updatedAt: nowMs(),
        lastError: null
      }
    },
    { merge: true }
  );

  const cmd = await commandsService.createCommand({
    boxId,
    type: "close",
    source,
    requestedBy,
    payload: {}
  });

  return { success: true, commandId: cmd.id };
}

export async function setBoxFinalState(boxId, finalState, extra = {}) {
  const ref = boxRefById(boxId);
  await ref.set(
    {
      status: {
        state: finalState, // "open" | "closed" | "error"
        desired: null,
        updatedAt: nowMs(),
        ...extra
      }
    },
    { merge: true }
  );
}
