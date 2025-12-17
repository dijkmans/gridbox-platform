// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import { db } from "../firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

const router = Router();

// ======================================================
// COMMANDS (Firestore is single source of truth)
// ======================================================

/**
 * GET /api/boxes/:boxId/commands
 * Agent haalt huidig command op
 */
router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;
    const ref = doc(db, "boxCommands", boxId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
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
 * Agent bevestigt uitvoering, command wordt verwijderd
 */
router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;
    await deleteDoc(doc(db, "boxCommands", boxId));
    res.json({ ok: true });
  } catch (err) {
    console.error("Command ack error:", err);
    res.status(500).json({ ok: false });
  }
});

// ======================================================
// BOX ROUTES
// ======================================================

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
    res.json(await boxesService.getAll());
  } catch {
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
  } catch {
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/open
 * Maakt OPEN command aan in Firestore
 */
router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    await setDoc(doc(db, "boxCommands", id), {
      id: `cmd-${Date.now()}`,
      type: "open",
      createdAt: serverTimestamp()
    });

    res.json({ ok: true, command: "open", boxId: id });
  } catch (err) {
    console.error("Open command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 * Maakt CLOSE command aan in Firestore
 */
router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    await setDoc(doc(db, "boxCommands", id), {
      id: `cmd-${Date.now()}`,
      type: "close",
      createdAt: serverTimestamp()
    });

    res.json({ ok: true, command: "close", boxId: id });
  } catch (err) {
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;

