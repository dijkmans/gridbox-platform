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

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;

    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
        cur = cur[part];
      } else {
        ok = false;
        break;
      }
    }

    if (ok && cur !== undefined) return cur;
  }
  return undefined;
}

function normalizePhones(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    // array van strings
    if (raw.length && typeof raw[0] === "string") {
      return raw.filter(Boolean).map(p => ({ phone: String(p), label: "" }));
    }

    // array van objecten
    if (raw.length && typeof raw[0] === "object") {
      return raw
        .map(x => ({
          phone: x.phone ?? x.number ?? x.tel ?? "",
          label: x.label ?? x.name ?? ""
        }))
        .filter(x => x.phone);
    }
  }

  return [];
}

function normalizeBox(id, data) {
  const d = data || {};

  // Deze platte velden gebruiken we voor de portal
  const customer = pick(d, ["customer", "Portal.Customer", "portal.customer"]);
  const site = pick(d, ["site", "Portal.Site", "portal.site"]);
  const boxNumber = pick(d, ["boxNumber", "Portal.BoxNumber", "portal.boxNumber"]);

  const status =
    pick(d, ["status.state", "state.state", "lifecycle.state", "status"]) ?? null;

  const online =
    pick(d, ["status.online", "state.online", "online", "status.isOnline"]) ?? null;

  const agentVersion =
    pick(d, ["agentVersion", "status.agentVersion", "agent.version"]) ?? null;

  const hardwareProfile =
    pick(d, ["hardwareProfile", "Portal.Profile", "portal.profile", "profile"]) ?? null;

  const lastSeenMinutes =
    pick(d, ["lastSeenMinutes", "status.lastSeenMinutes"]) ?? null;

  const sharesCount =
    pick(d, ["sharesCount", "Portal.sharesCount", "portal.sharesCount"]) ?? null;

  const phonesRaw =
    pick(d, ["phones", "Portal.phones", "portal.phones", "phoneNumbers"]) ?? null;

  const phones = normalizePhones(phonesRaw);

  // We laten de originele data bestaan, maar voegen ook platte velden toe
  return {
    id,
    ...d,

    customer: customer ?? null,
    site: site ?? null,
    boxNumber: boxNumber ?? null,

    status: status ?? null,
    online: online ?? null,

    agentVersion: agentVersion ?? null,
    hardwareProfile: hardwareProfile ?? null,

    lastSeenMinutes: lastSeenMinutes ?? null,
    sharesCount: sharesCount ?? null,

    phones
  };
}

export async function getAll() {
  const snap = await db.collection("boxes").get();
  return snap.docs.map(doc => normalizeBox(doc.id, doc.data()));
}

export async function getById(boxId) {
  const snap = await boxRefById(boxId).get();
  if (!snap.exists) return null;
  return normalizeBox(snap.id, snap.data());
}

/**
 * Open en Close zetten box status op pending,
 * en maken een command aan met deadline en retries.
 * Box status wordt pas "open/closed" als device result ok is.
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
