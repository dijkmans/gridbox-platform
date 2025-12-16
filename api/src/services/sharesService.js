import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";

// ------------------------------------------------------
// Firestore init (één keer)
// ------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// ------------------------------------------------------
// Hulpfunctie
// ------------------------------------------------------
function nowIso() {
  return new Date().toISOString();
}

// ------------------------------------------------------
// Publieke functies
// ------------------------------------------------------

/**
 * Zoekt een actieve share
 * op basis van telefoonnummer en boxnummer
 * Gebruikt door smsWebhook
 */
export async function findActiveShareByPhoneAndBoxNumber(
  phone,
  boxNumber
) {
  if (!phone || boxNumber === undefined || boxNumber === null) {
    return null;
  }

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("phone", "==", phone)
    .where("boxNumber", "==", Number(boxNumber))
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];

  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Geeft alle actieve shares voor een telefoonnummer
 */
export async function findActiveSharesByPhone(phone) {
  if (!phone) return [];

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("phone", "==", phone)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Deactiveert één share manueel
 */
export async function deactivateShare(shareId) {
  if (!shareId) return false;

  await db.collection("shares").doc(shareId).update({
    active: false,
    deactivatedAt: nowIso()
  });

  return true;
}

/**
 * Deactiveert automatisch alle verlopen shares
 * Wordt gebruikt door interne job
 */
export async function deactivateExpiredShares() {
  const now = nowIso();

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("expiresAt", "<", now)
    .get();

  if (snapshot.empty) {
    return { deactivated: 0 };
  }

  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      active: false,
      deactivatedAt: now
    });
    count++;
  });

  await batch.commit();

  return { deactivated: count };
}

/**
 * Zoekt shares die binnen een bepaalde tijd vervallen
 * Gebruikt voor waarschuwing 1 uur vooraf
 */
export async function findSharesExpiringBefore(isoTime) {
  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("expiresAt", "<=", isoTime)
    .where("warnedAt", "==", null)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Markeert dat de waarschuwing is verstuurd
 */
export async function markWarningSent(shareId) {
  if (!shareId) return false;

  await db.collection("shares").doc(shareId).update({
    warnedAt: nowIso()
  });

  return true;
}
