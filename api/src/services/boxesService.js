// api/src/services/boxesService.js
// Bewust simpel gehouden: boxes ophalen, shares lijst, en OPEN/CLOSE commands aanmaken.

import { db } from "../firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function normalizeBool(v) {
  if (v === true) return true;
  if (v === "true") return true;
  return false;
}

function isActiveShare(s) {
  if (!s) return false;
  if (normalizeBool(s.active)) return true;
  if (s.status === "active") return true;
  return false;
}

function normalizeCommandType(type) {
  if (!type) return null;
  return String(type).trim().toUpperCase();
}

// ---------------------------------------------------------
// BOXES
// ---------------------------------------------------------
export async function getAll() {
  const snap = await db.collection("boxes").limit(200).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getById(boxId) {
  const doc = await db.collection("boxes").doc(boxId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function getShares(boxId) {
  const snap = await db
    .collection("shares")
    .where("boxId", "==", boxId)
    .limit(50)
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => isActiveShare(s));
}

// ---------------------------------------------------------
// COMMANDS (OPEN / CLOSE)
// ---------------------------------------------------------
async function addCommand(boxId, type, source = "api", actor = null, meta = {}) {
  const commandType = normalizeCommandType(type);
  if (!commandType) {
    return { success: false, message: "Command type ontbreekt" };
  }

  // Check dat box bestaat
  const boxDoc = await db.collection("boxes").doc(boxId).get();
  if (!boxDoc.exists) {
    return { success: false, message: `Box ${boxId} niet gevonden` };
  }

  const command = {
    type: commandType,
    status: "pending",
    source,
    actor,
    meta,
    createdAt: Timestamp.now()
  };

  const ref = await db
    .collection("boxes")
    .doc(boxId)
    .collection("commands")
    .add(command);

  return {
    success: true,
    message: `${commandType} command aangemaakt`,
    command: { id: ref.id, ...command }
  };
}

// SMS gebruikt dit
export async function openBox(boxId, source = "sms", actor = null) {
  return addCommand(boxId, "OPEN", source, actor);
}

export async function closeBox(boxId, source = "api", actor = null) {
  return addCommand(boxId, "CLOSE", source, actor);
}
