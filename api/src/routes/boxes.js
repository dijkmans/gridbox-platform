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

// ------------------------------------------------------
// COMMANDS (Firestore-based, Cloud Run proof)
// ------------------------------------------------------

/**
 * GET /api/boxes/:boxId/commands
 * Geeft huidig command terug of null
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
    console.error("Fout bij ophalen command:", err);
    res.status(500).json(null);
  }
});

/**
 * POST /api/boxes/:boxId/commands/:commandId/ack
 * Verwijdert command na uitvoering
 */
router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;
    const ref = doc(db, "boxCommands", boxId);

    await deleteDoc(ref);

    res.json({ ok: true });
  } catch (err) {
    console.error("Fout bij ack command:", err);
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
    console.error("Fout bij ophalen boxen:", err);
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
      commandId: `cmd-${Date.now()}`,
      type: "open",
      status: "pending",
      createdAt: serverTimestamp()
    });

    res.json({
      ok: true,
      command: "open",
      boxId: id
    });
  } catch (err) {
    console.error("Fout bij open command:", err);
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
      commandId: `cmd-${Date.now()}`,
      type: "close",
      status: "pending",
      createdAt: serverTimestamp()
    });

    res.json({
      ok: true,
      command: "close",
      boxId: id
    });
  } catch (err) {
    console.error("Fout bij close command:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
