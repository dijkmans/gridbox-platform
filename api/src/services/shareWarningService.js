import { getFirestore } from "firebase-admin/firestore";
import { buildExpiryWarningSms } from "../utils/shareMessages.js";

const db = getFirestore();

/**
 * Verstuurt waarschuwingen voor shares
 * die binnen het uur verlopen
 */
export async function sendExpiryWarnings() {
  const now = new Date();

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("warningSent", "==", false)
    .get();

  if (snapshot.empty) {
    return {
      sent: 0
    };
  }

  let sentCount = 0;

  for (const doc of snapshot.docs) {
    const share = {
      id: doc.id,
      ...doc.data()
    };

    if (!share.expiresAt || !share.blockedAt) {
      continue;
    }

    const expiresAt = new Date(share.expiresAt);
    const blockedAt = new Date(share.blockedAt);

    // Enkel binnen het waarschuwingsvenster
    if (now < expiresAt || now >= blockedAt) {
      continue;
    }

    const smsText = buildExpiryWarningSms({
      boxNumber: share.boxNumber,
      blockedAt: share.blockedAt
    });

    // Voorlopig: simulatie via log
    console.log("⚠️ EXPIRY WARNING SMS (simulatie):", {
      to: share.phone,
      message: smsText
    });

    // Markeer als verzonden
    await db
      .collection("shares")
      .doc(share.id)
      .update({
        warningSent: true
      });

    sentCount++;
  }

  return {
    sent: sentCount
  };
}
