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

      const expiresAt = new Date(share.expiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff > 0 && diff <= oneHourMs) {
        const smsText =
          `Uw toegang tot Gridbox ${share.boxNumber} ` +
          `vervalt binnen 1 uur. ` +
          `U kan de Gridbox nog gebruiken tot ${expiresAt.toLocaleString()}.`;

        console.log("⚠️ WAARSCHUWING SMS (simulatie):", {
          to: share.phone,
          message: smsText
        });

        await db.collection("shares").doc(doc.id).update({
          warnedAt: now.toISOString()
        });

        sent++;
      }
    }

    return res.json({
      ok: true,
      result: { sent }
    });

  } catch (err) {
    console.error("❌ expiry warning error:", err);
    return res.status(500).json({
      ok: false,
      message: "Fout bij versturen waarschuwingen"
    });
  }
});

export default router;
