import { Router } from "express";
import { db } from "../services/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/events/:boxId
 */
router.post("/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { type, source = "unknown", meta = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        ok: false,
        error: "Event type is verplicht"
      });
    }

    const event = {
      type,
      source,
      meta,
      createdAt: Timestamp.now()
    };

    await db
      .collection("boxes")
      .doc(boxId)
      .collection("events")
      .add(event);

    return res.json({
      ok: true,
      message: "Event opgeslagen",
      boxId
    });

  } catch (err) {
    console.error("Fout bij opslaan event:", err);
    return res.status(500).json({
      ok: false,
      error: "Interne serverfout"
    });
  }
});

export default router;
