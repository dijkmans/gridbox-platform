import { Router } from "express";
import { db } from "../lib/firestore.js";
import { Timestamp } from "firebase-admin/firestore";

const router = Router();

/**
 * POST /api/events/:boxId
 * Ontvang en log events van een Gridbox (bv van de Raspberry Pi)
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
