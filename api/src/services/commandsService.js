// api/src/services/commandsService.js
import { db } from "../db.js";

/**
 * Dit servicebestand doet 3 dingen:
 * 1) command aanmaken met deadlineAt
 * 2) command ophalen voor device (atomair: queued -> delivered)
 * 3) retries + timeouts afhandelen (delivered te lang -> requeue, te laat -> timed_out)
 */

function nowMs() {
  return Date.now();
}

function msFromEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function intFromEnv(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

// Defaults (kan je via env overschrijven)
const COMMAND_TTL_MS = msFromEnv("COMMAND_TTL_MS", 120000); // 2 min
const DELIVERY_TTL_MS = msFromEnv("DELIVERY_TTL_MS", 30000); // 30 sec
const MAX_ATTEMPTS = intFromEnv("MAX_COMMAND_ATTEMPTS", 3);

function boxRef({ orgId, boxId }) {
  if (!boxId) throw new Error("boxId is required");
  if (!db) throw new Error("Firestore db is not initialized");
  if (orgId) return db.collection("orgs").doc(orgId).collection("boxes").doc(boxId);
  return db.collection("boxes").doc(boxId);
}

function commandsCol({ orgId, boxId }) {
  return boxRef({ orgId, boxId }).collection("commands");
}

export async function createCommand({
  orgId = null,
  boxId,
  type,
  source = "api",
  requestedBy = null,
  payload = {}
}) {
  const createdAt = nowMs();
  const deadlineAt = createdAt + COMMAND_TTL_MS;

  const doc = {
    type, // "open" | "close"
    source,
    requestedBy,
    payload,

    status: "queued", // queued | delivered | done | failed | timed_out
    attempts: 0,

    createdAt,
    deadlineAt,

    deliveredAt: null,
    executedAt: null,

    lastError: null
  };

  const ref = await commandsCol({ orgId, boxId }).add(doc);
  return { id: ref.id, ...doc };
}

/**
 * Runs op elke poll:
 * - queued met deadline voorbij -> timed_out
 * - delivered te lang geleden -> requeue of failed (als max attempts)
 */
export async function reconcileQueue({ orgId = null, boxId }) {
  if (!db) return { ok: true, updated: 0 };

  const col = commandsCol({ orgId, boxId });
  const now = nowMs();

  // 1) queued timeouts
  const queuedSnap = await col.where("status", "==", "queued").get();
  const batch1 = db.batch();
  let n1 = 0;

  queuedSnap.forEach((d) => {
    const c = d.data() || {};
    if (typeof c.deadlineAt === "number" && now > c.deadlineAt) {
      batch1.update(d.ref, {
        status: "timed_out",
        executedAt: now,
        lastError: "timeout (queued)"
      });
      n1++;
    }
  });

  if (n1 > 0) await batch1.commit();

  // 2) delivered -> requeue
  const deliveredSnap = await col.where("status", "==", "delivered").get();
  const batch2 = db.batch();
  let n2 = 0;

  deliveredSnap.forEach((d) => {
    const c = d.data() || {};
    const deliveredAt = typeof c.deliveredAt === "number" ? c.deliveredAt : 0;
    const deadlineAt = typeof c.deadlineAt === "number" ? c.deadlineAt : 0;
    const attempts = typeof c.attempts === "number" ? c.attempts : 0;

    const tooLate = deadlineAt && now > deadlineAt;
    const tooLongDelivered = deliveredAt && now > deliveredAt + DELIVERY_TTL_MS;

    if (tooLate) {
      batch2.update(d.ref, {
        status: "timed_out",
        executedAt: now,
        lastError: "timeout (delivered)"
      });
      n2++;
      return;
    }

    if (tooLongDelivered) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        batch2.update(d.ref, {
          status: "failed",
          executedAt: now,
          attempts: nextAttempts,
          lastError: "max attempts reached"
        });
      } else {
        batch2.update(d.ref, {
          status: "queued",
          attempts: nextAttempts,
          deliveredAt: null,
          lastError: "requeued after delivery timeout"
        });
      }
      n2++;
    }
  });

  if (n2 > 0) await batch2.commit();

  return { ok: true, updated: n1 + n2 };
}

/**
 * Device poll: haalt 1 queued command op en zet atomair op delivered.
 */
export async function popNextCommand({ orgId = null, boxId, deviceId = null }) {
  if (!db) return null;

  await reconcileQueue({ orgId, boxId });

  const col = commandsCol({ orgId, boxId });
  const now = nowMs();

  // BELANGRIJK: geen orderBy, zodat Firestore geen extra index nodig heeft
  const q = await col.where("status", "==", "queued").limit(1).get();

  if (q.empty) return null;

  const docRef = q.docs[0].ref;

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return null;

    const cmd = snap.data() || {};
    if (cmd.status !== "queued") return null;

    // nog eens deadline check
    if (typeof cmd.deadlineAt === "number" && now > cmd.deadlineAt) {
      tx.update(docRef, {
        status: "timed_out",
        executedAt: now,
        lastError: "timeout (transaction)"
      });
      return null;
    }

    tx.update(docRef, {
      status: "delivered",
      deliveredAt: now,
      deliveredTo: deviceId || null
    });

    return {
      id: snap.id,
      ...cmd,
      status: "delivered",
      deliveredAt: now,
      deliveredTo: deviceId || null
    };
  });

  return result;
}

export async function submitResult({ orgId = null, boxId, commandId, ok, error = null, result = null }) {
  if (!db) return { ok: true };

  const ref = commandsCol({ orgId, boxId }).doc(commandId);
  const now = nowMs();

  const patch = {
    status: ok ? "done" : "failed",
    executedAt: now,
    lastError: ok ? null : String(error || "unknown error"),
    result: result || null
  };

  await ref.update(patch);

  return { ok: true };
}
