import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";

// ------------------------------------------------------
// Firestore init (veilig, maar maar één keer)
// ------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// ------------------------------------------------------
// Interne mapping: boxnummer -> boxId
// Dit is bewust hardcoded voor nu
// ------------------------------------------------------
const BOX_NUMBER_MAP = {
  "1": "gbox-001",
  "2": "gbox-002",
  "3": "gbox-001", // voorbeeld: Gridbox 3 = gbox-001
  "4": "gbox-002"
};

// ------------------------------------------------------
// Hulpfunctie: boxnummer omzetten naar boxId
// ------------------------------------------------------
function resolveBoxId(boxNumber) {
  if (!boxNumber) return null;
  return BOX_NUMBER_MAP[String(boxNumber)] || null;
}

// ------------------------------------------------------
// Publieke functies
// ------------------------------------------------------

/**
 * Zoekt een actieve share op basis van telefoonnummer én boxnummer
 * Wordt gebruikt door SMS inbound
 */
export async function findActiveShareByPhoneAndBox(phone, boxNumber) {
  if (!phone || !boxNumber) {
    return null;
  }

  const boxId = resolveBoxId(boxNumber);
  if (!boxId) {
    return null;
  }

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("phone", "==", phone)
    .where("boxId", "==", boxId)
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
 * (optioneel, handig voor debugging of later gebruik)
 * Zoekt alle actieve shares voor een telefoonnummer
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
 * (optioneel)
 * Share deactiveren
 */
export async function deactivateShare(shareId) {
  if (!shareId) return false;

  await db.collection("shares").doc(shareId).update({
    active: false,
    deactivatedAt: new Date().toISOString()
  });

  return true;
}
