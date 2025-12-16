import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();
const db = getFirestore();

/**
 * POST /api/internal/send-expiry-warnings
 * Stuurt een waarschuwing 1 uur voor vervaldatum
 */
router.post("/send-expiry-warnings", async (req, res) => {
  try {
    const now = new Date();
    const oneHourMs = 60 * 60 * 1000;

    const snapshot = await db
      .collection("shares")
      .where("active", "==", true)
      .get();

    let sent = 0;

    for (const doc of snapshot.docs) {
      const share = doc.data();

      if (!share.expiresAt) continue;
      if (share.warnedAt) continue;

      // Firestore Timestamp correct omzetten
      const expiresAt =
        share.expiresAt.toDate
          ? share.expiresAt.toDate()
          : new Date(share.expiresAt);

      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs > 0 && diffMs <= oneHourMs) {
        const smsText =
          `Uw toegang tot Gridbox ${share.boxNumber} ` +
          `vervalt binnen 1 uur. ` +
          `U kan de Gridbox gebruiken tot ${expiresAt.toLocaleString("nl-BE")}.`;

        console.log("⚠️ WAARSCHUWING SMS (simulatie):", {
          to: share.phone,
          message: smsText
        });

        await db.collection("shares").doc(doc.id).update({
          warnedAt: now
        });

        sent++;
      }
    }

    return res.json({
      ok: true,
      result: { sent }
    });

  } catch (err) {
    console.error("❌ send-expiry-warnings error:", err);
    return res.status(500).json({
      ok: false,
      message: "Fout bij versturen waarschuwingen"
    });
  }
});

/**
 * POST /api/internal/deactivate-expired-shares
 * Zet verlopen shares automatisch inactief
 */
router.post("/deactivate-expired-shares", async (req, res) => {
  try {
    const now = new Date();

    const snapshot = await db
      .collection("shares")
      .where("active", "==", true)
      .get();

    let deactivated = 0;

    for (const doc of snapshot.docs) {
      const share = doc.data();

      if (!share.expiresAt) continue;

      const expiresAt =
        share.expiresAt.toDate
          ? share.expiresAt.toDate()
          : new Date(share.expiresAt);

      if (expiresAt <= now) {
        console.log("⛔ SHARE VERLOPEN:", {
          phone: share.phone,
          boxNumber: share.boxNumber
        });

        await db.collection("shares").doc(doc.id).update({
          active: false,
          deactivatedAt: now
        });

        deactivated++;
      }
    }

    return res.json({
      ok: true,
      result: { deactivated }
    });

  } catch (err) {
    console.error("❌ deactivate-expired-shares error:", err);
    return res.status(500).json({
      ok: false,
      message: "Fout bij deactiveren verlopen shares"
    });
  }
});

export default router;
