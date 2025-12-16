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
        console.log("⚠️ WAARSCHUWING SMS (simulatie):", {
          to: share.phone,
          box: share.boxNumber
        });

        await db.collection("shares").doc(doc.id).update({
          warnedAt: now.toISOString()
        });

        sent++;
      }
    }

    return res.json({ ok: true, result: { sent } });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
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

      const expiresAt = new Date(share.expiresAt);

      if (expiresAt <= now) {
        console.log("⛔ SHARE VERLOPEN:", {
          phone: share.phone,
          box: share.boxNumber
        });

        await db.collection("shares").doc(doc.id).update({
          active: false,
          deactivatedAt: now.toISOString()
        });

        deactivated++;
      }
    }

    return res.json({
      ok: true,
      result: { deactivated }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
