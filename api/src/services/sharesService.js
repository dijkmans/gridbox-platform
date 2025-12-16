import { db } from "../lib/firestore.js";

/**
 * Haal alle geldige shares op voor een telefoonnummer
 */
export async function findValidSharesByPhone(phone) {
  const snapshot = await db
    .collection("shares")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .get();

  const now = new Date();
  const shares = [];

  snapshot.forEach(doc => {
    const data = doc.data();

    const validFromOk =
      !data.validFrom || data.validFrom.toDate() <= now;

    const validUntilOk =
      !data.validUntil || data.validUntil.toDate() >= now;

    if (validFromOk && validUntilOk) {
      shares.push({
        id: doc.id,
        ...data
      });
    }
  });

  return shares;
}
