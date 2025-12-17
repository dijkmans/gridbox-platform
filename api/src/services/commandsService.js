// api/src/services/commandsService.js
import { db } from "../db.js";

/**
 * DEFINITIEF COMMAND CONTRACT
 *
 * Firestore pad:
 * boxes/{boxId}/commands/{commandId}
 *
 * Status flow:
 * queued    → delivered → done
 * queued    → expired
 * delivered → error
 *
 * Een command wordt NOOIT verplaatst of verwijderd tijdens de flow.
 */

function nowMs() {
  return Date.now();
}

function intFromEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const COMMAND_TIMEOUT_MS = intFromEnv("COMMAND_TIMEOUT_MS", 2 * 60 * 1000);
const MAX_ATTEMPTS = intFromEnv("COMMAND_MAX_ATTEMPTS", 3);

function commandsCol(boxId) {
  if (!db) throw new Error("db is null");
  return db.collection("boxes").doc(boxId).collection("commands");
}

// --------------------------------------------------
// Command aanmaken (bijv. vanuit SMS)
// --------------------------------------------------
export async function createCommand({
  boxId,
  type,
  source,
  requestedBy,
  payload = {}
}) {
  const now = nowMs();

  const cmd = {
    type,
    source,
    requestedBy,
    payload,

    status: "queued",
    attempts: 0,

    createdAt: now,
    deadlineAt: now + COMMAND_TIMEOUT_MS,

    deliveredAt: null,
    deliveredTo: null,

    executedAt: null,
    lastError: null,
    result: null
  };

  const ref = await commandsCol(boxId).add(cmd);
  return { id: ref.id, ...cmd };
}

// --------------------------------------------------
// Volgende command ophalen voor device
// --------------------------------------------------
export async function popNextCommand({ boxId, deviceId }) {
  const now = nowMs();

  const snap = await commandsCol(boxId)
    .where("status", "in", ["queued", "delivered"])
    .limit(10)
    .get();

  if (snap.empty) return null;

  for (const doc of snap.docs) {
    const cmd = doc.data();
    const ref = doc.ref;

    // verlopen?
    if (cmd.deadlineAt && cmd.deadlineAt < now) {
      await ref.update({
        status: "expired",
        lastError: "timeout",
        executedAt: now
      });
      continue;
    }

    // te veel pogingen?
    if ((cmd.attempts || 0) >= MAX_ATTEMPTS) {
      await ref.update({
        status: "error",
        lastError: "max attempts reached",
        executedAt: now
      });
      continue;
    }

    // markeer als delivered
    await ref.update({
      status: "delivered",
      deliveredAt: now,
      deliveredTo: deviceId || null,
      attempts: (cmd.attempts || 0) + 1
    });

    return {
      id: doc.id,
      ...cmd,
      status: "delivered",
      deliveredAt: now,
      deliveredTo: deviceId || null,
      attempts: (cmd.attempts || 0) + 1
    };
  }

  return null;
}

// --------------------------------------------------
// Resultaat van device verwerken
// --------------------------------------------------
export async function submitResult({
  boxId,
  commandId,
  ok,
  error = null,
  result = null
}) {
  const ref = commandsCol(boxId).doc(commandId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`command ${commandId} niet gevonden`);
  }

  const now = nowMs();

  if (ok) {
    await ref.update({
      status: "done",
      executedAt: now,
      result: result || null,
      lastError: null
    });
  } else {
    await ref.update({
      status: "error",
      executedAt: now,
      lastError: String(error || "unknown error")
    });
  }

  return true;
}
