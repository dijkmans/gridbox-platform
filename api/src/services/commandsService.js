// api/src/services/commandsService.js
import { db } from "../db.js";

/*
Command lifecycle – definitief

Status:
- queued     : aangemaakt, nog niet opgehaald
- delivered  : opgehaald door device
- done       : succesvol uitgevoerd
- error      : uitgevoerd maar gefaald
- expired    : niet uitgevoerd binnen deadline

Belangrijk:
- commands worden NOOIT verplaatst of verwijderd
- alleen statusvelden veranderen
*/

function nowMs() {
  return Date.now();
}

function intFromEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const COMMAND_DEADLINE_MS = intFromEnv("COMMAND_DEADLINE_MS", 2 * 60 * 1000);
const COMMAND_MAX_ATTEMPTS = intFromEnv("COMMAND_MAX_ATTEMPTS", 3);

function commandsCollection(boxId) {
  if (!boxId) throw new Error("boxId ontbreekt");
  return db.collection("boxes").doc(boxId).collection("commands");
}

/**
 * Command aanmaken
 */
export async function createCommand({
  boxId,
  type,
  source = "api",
  requestedBy = null,
  payload = {}
}) {
  const col = commandsCollection(boxId);
  const now = nowMs();

  const command = {
    type,
    source,
    requestedBy,
    payload,

    status: "queued",
    attempts: 0,

    createdAt: now,
    deadlineAt: now + COMMAND_DEADLINE_MS,

    deliveredAt: null,
    deliveredTo: null,

    executedAt: null,
    lastError: null,
    result: null
  };

  const ref = await col.add(command);
  return { id: ref.id, ...command };
}

/**
 * Volgende command ophalen voor device
 * queued -> delivered
 */
export async function popNextCommand({ boxId, deviceId }) {
  const col = commandsCollection(boxId);
  const now = nowMs();

  // 1. Verlopen commands markeren
  const activeSnap = await col
    .where("status", "in", ["queued", "delivered"])
    .get();

  for (const doc of activeSnap.docs) {
    const d = doc.data();
    if (d.deadlineAt && d.deadlineAt < now) {
      await doc.ref.update({
        status: "expired",
        executedAt: now,
        lastError: "deadline expired"
      });
    }
  }

  // 2. Zoek eerstvolgende queued command
  const snap = await col
    .where("status", "==", "queued")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();

  // 3. Max attempts check
  if ((data.attempts || 0) >= COMMAND_MAX_ATTEMPTS) {
    await doc.ref.update({
      status: "error",
      executedAt: now,
      lastError: "max attempts exceeded"
    });
    return null;
  }

  // 4. Claim command
  await doc.ref.update({
    status: "delivered",
    deliveredAt: now,
    deliveredTo: deviceId || null,
    attempts: (data.attempts || 0) + 1
  });

  return {
    id: doc.id,
    ...data,
    status: "delivered"
  };
}

/**
 * Resultaat van command
 */
export async function submitResult({
  boxId,
  commandId,
  ok,
  error = null,
  result = null
}) {
  const col = commandsCollection(boxId);
  const ref = col.doc(commandId);

  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Command ${commandId} bestaat niet`);
  }

  const data = snap.data();
  if (data.status !== "delivered") {
    throw new Error(
      `Command ${commandId} heeft status ${data.status}, verwacht delivered`
    );
  }

  await ref.update({
    status: ok ? "done" : "error",
    executedAt: nowMs(),
    lastError: ok ? null : String(error || "unknown error"),
    result: result || null
  });

  return { ok: true };
}
