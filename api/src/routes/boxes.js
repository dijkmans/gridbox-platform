// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import admin from "firebase-admin";

const router = Router();

// ------------------------------------------------------
// Firestore (via firebase-admin)
// ------------------------------------------------------

const db = admin.firestore();

// ------------------------------------------------------
// COMMANDS (Firestore based, backend-safe)
// ------------------------------------------------------

/**
 * GET /api/boxes/:boxId/commands
 * Geeft huidig pending command terug of null
 */
router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;

    const ref = db.collection("boxCommands").doc(boxId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.json(null);
    }

    return res.json(snap.data());
  } catch (err) {
    console.error("Command fetch error:", err);
    res.status(500).json(null);
  }
});

/**
 * POST /api/boxes/:boxId/commands/:commandId/ack
 * Verwijdert command na uitvoering door agent
 */
router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;

    await db.collection("boxCommands").doc(boxId).delete();

    res.json({ ok: true });
  } catch (err) {
    console.error("Command ack error:", err);
    res.status(500).json({ ok: false });
  }
});

// ------------------------------------------------------
// BOX ROUTES
// ------------------------------------------------------

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
    const boxes = await boxesService.getAll();
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);
    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }
    res.json(box);
  } catch (err) {
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/open
 * Zet OPEN command in Firestore
 */
router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("boxCommands").doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "open",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      ok: true,
      command: "open",
      boxId: id
    });
  } catch (err) {
    console.error("Open command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 * Zet CLOSE command in Firestore
 */
router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("boxCommands").doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "close",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      ok: true,
      command: "close",
      boxId: id
    });
  } catch (err) {
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;

