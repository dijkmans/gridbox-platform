import { Router } from "express";
import { db } from "../services/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/status/:boxId
 * Ontvang status / heartbeat van een Gridbox (Pi)
 */
router.post("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const online = payload.online ?? true;
    const uptime = payload.uptime ?? null;
    const temp = payload.temp ?? null;

    // Bewaar ook extra velden zoals door/lock/... die de Pi doorstuurt
    const status = {
      ...payload,
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

/**
 * GET /api/status/:boxId
 * Status opvragen (dashboard, monitoring)
 */
router.get("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    const snap = await db
      .collection("boxes")
      .doc(boxId)
      .get();

    if (!snap.exists) {
      return res.status(404).json({
        ok: false,
        error: "Box niet gevonden"
      });
    }

    const data = snap.data();
    const status = data.status || {};

    const lastSeen = status.lastSeen?.toDate?.();
    let online = false;

    if (lastSeen) {
      const diffSeconds = (Date.now() - lastSeen.getTime()) / 1000;
      online = diffSeconds < 180; // online als laatste update < 3 minuten
    }

    return res.json({
      ok: true,
      boxId,
      status: {
        ...status,
        online,
        lastSeen
      }
    });

  } catch (err) {
    console.error("Fout bij status ophalen:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout"
    });
  }
});

export default router;
