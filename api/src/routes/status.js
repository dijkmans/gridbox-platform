import { Router } from "express";
import { db } from "../services/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/status/:boxId
 * Raspberry Pi stuurt status en heartbeat
 */
router.post("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    const {
      state = null,          // open | closed | opening | closing
      source = null,         // button | platform
      online = true,
      uptime = null,         // seconden
      temp = null,           // °C, optioneel
      type = null            // heartbeat | status
    } = req.body;

    const statusUpdate = {
      online,
      lastSeen: Timestamp.now()
    };

    if (state !== null) statusUpdate.state = state;
    if (source !== null) statusUpdate.source = source;
    if (uptime !== null) statusUpdate.uptime = uptime;
    if (temp !== null) statusUpdate.temp = temp;
    if (type !== null) statusUpdate.type = type;

    await db
      .collection("boxes")
      .doc(boxId)
      .set(
        {
          status: statusUpdate
        },
        { merge: true }
      );

    return res.json({
      ok: true,
      boxId,
      status: statusUpdate
    });

  } catch (err) {
    console.error("Fout bij status update:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout bij status update"
    });
  }
});

/**
 * GET /api/status/:boxId
 * Status ophalen (dashboard / monitoring)
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

    const lastSeenDate = status.lastSeen?.toDate?.() || null;

    let online = false;
    if (lastSeenDate) {
      const diffSeconds = (Date.now() - lastSeenDate.getTime()) / 1000;
      online = diffSeconds < 180; // online als < 3 min geleden
    }

    return res.json({
      ok: true,
      boxId,
      status: {
        ...status,
        online,
        lastSeen: lastSeenDate
      }
    });

  } catch (err) {
    console.error("Fout bij status ophalen:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout bij status ophalen"
    });
  }
});

export default router;
