import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Zoekt shares die binnen 1 uur vervallen
 * en nog geen waarschuwing kregen
 */
export async function sendExpiryWarnings() {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const snapshot = await db
    .collection("shares")
    .where("active", "==", true)
    .where("expiryWarningSent", "==", false)
    .where("expiresAt", "<=", oneHourLater.toISOString())
    .get();

  let sent = 0;

  for (const doc of snapshot.docs) {
    const share = doc.data();

    const expiresAtLocal = new Date(share.expiresAt).toLocaleTimeString(
      "nl-BE",
      { hour: "2-digit", minute: "2-digit" }
    );

    const smsText =
      `Opgelet: uw toegang tot Gridbox ${share.boxNumber} vervalt over 1 uur.\n` +
      `U kan de Gridbox nog openen of sluiten tot ${expiresAtLocal}.\n` +
      `Antwoord met OPEN ${share.boxNumber} om de Gridbox te openen.`;

    // voorlopig enkel loggen (geen echte SMS)
    console.log("📤 EXPIRY WARNING SMS:", {
      to: share.phone,
      message: smsText
    });

    await doc.ref.update({
      expiryWarningSent: true
    });

    sent++;
  }

  return { sent };
}
