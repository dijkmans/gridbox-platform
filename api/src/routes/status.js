import { Router } from "express";
import { db } from "../services/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/status/:boxId
 * Ontvang heartbeat/status van een Gridbox (Pi)
 */
router.post("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { online = true, uptime = null, temp = null } = req.body;

    const status = {
      online,
      uptime,
      temp,
      lastSeen: Timestamp.now()
    };

    await db
      .collection("boxes")
      .doc(boxId)
      .set({ status }, { merge: true });

    return res.json({
      ok: true,
      message: "Status bijgewerkt",
      boxId
    });

  } catch (err) {
    console.error("Fout bij status update:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout"
    });
  }
});

export default router;
