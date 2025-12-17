// api/src/services/commandsService.js
import { db } from "../db.js";

/**
 * Command lifecycle – definitief contract
 *
 * Statussen:
 * - queued     : aangemaakt, nog niet opgehaald
 * - delivered  : opgehaald door een device (deviceId gekend)
 * - done       : succesvol uitgevoerd (result ok = true)
 * - error      : uitgevoerd maar gefaald (result ok = false)
 * - expired    : niet uitgevoerd binnen deadline
 *
 * Flow:
 * SMS / API  -> createCommand (queued)
 * Device     -> popNextCommand (queued -> delivered)
 * Device     -> submitResult (delivered -> done | error)
 * Systeem    -> expire oude commands
 */

function nowMs() {
  return Date.now();
}

function intFromEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// defaults (veilig, geen Firestore indexes nodig)
const COMMAND_DEADLINE_MS = intFromEnv("COMMAND_DEADLINE_MS", 2 * 60 * 1000); // 2 min
const COMMAND_MAX_ATTEMPTS = intFromEnv("COMMAND_MAX_ATTEMPTS", 3);

/**
 * Helpers om de juiste collection te kiezen
 */
function commandsCollection({ orgId, boxId }) {
  if (!boxId) throw new Error("boxId ontbreekt.");
  if (orgId) {
    return db
      .collection("orgs")
      .doc(orgId)
      .collection("boxes")
      .doc(boxId)
      .collection("commands");
  }
  return db.collection("boxes").doc(boxId).collection("commands");
}

/**
 * 1. Command aanmaken
 */
export async function createCommand({
  orgId = null,
  boxId,
  type,
  source = "api",
  requestedBy = null,
  payload = {}
}) {
  const col = commandsCollection({ orgId, boxId });

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
    lastError: null
  };

  const ref = await col.add(command);
  return { id: ref.id, ...command };
}

/**
 * 2. Volgende command ophalen voor device
 *    - atomair: queued -> delivered
 *    - geen orderBy (vermijdt index issues)
 */
export async function popNextCommand({
  orgId = null,
  boxId,
  deviceId = null
}) {
  const col = commandsCollection({ orgId, boxId });
  const now = nowMs();

  // 2.1 eerst verlopen commands markeren
  const expiredSnap = await col
    .where("status", "in", ["queued", "delivered"])
    .get();

  for (const doc of expiredSnap.docs) {
    const data = doc.data();
    if (data.deadlineAt && data.deadlineAt < now) {
      await doc.ref.update({
        status: "expired",
        executedAt: now,
        lastError: "deadline expired"
      });
    }
  }

  // 2.2 zoek eerst queued commands
  const snap = await col.where("status", "==", "queued").limit(1).get();
  if (snap.empty) return null;

  const doc = snap.docs[0];

  // 2.3 atomair claimen
  await doc.ref.update({
    status: "delivered",
    deliveredAt: now,
    deliveredTo: deviceId || null,
    attempts: (doc.data().attempts || 0) + 1
  });

  return { id: doc.id, ...doc.data(), status: "delivered" };
}

/**
 * 3. Resultaat van command verwerken
 */
export async function submitResult({
  orgId = null,
  boxId,
  commandId,
  ok,
  error = null,
  result = null
}) {
  const col = commandsCollection({ orgId, boxId });
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

  const update = {
    executedAt: nowMs(),
    status: ok ? "done" : "error",
    lastError: ok ? null : String(error || "unknown error"),
    result: result || null
  };

  await ref.update(update);
  return { id: commandId, ...update };
}
