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
// Publieke functies
// ------------------------------------------------------

/**
 * Zoekt een actieve share
 * op basis van telefoonnummer en boxnummer
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
 * Deactiveert een share
 */
export async function deactivateShare(shareId) {
  if (!shareId) return false;

  await db.collection("shares").doc(shareId).update({
    active: false,
    deactivatedAt: new Date().toISOString()
  });

  return true;
}
