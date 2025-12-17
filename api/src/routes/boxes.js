// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";

const router = Router();

// ------------------------------------------------------
// COMMANDS (MOET BOVENAAN STAAN)
// ------------------------------------------------------

const pendingCommands = new Map();

/**
 * GET /api/boxes/:boxId/commands
<<<<<<< HEAD
 * Agent haalt huidig command op
=======
 * Geeft huidig command terug of null
>>>>>>> 4224a44 (Simplify commands: open/close only create pending command)
 */
router.get("/:boxId/commands", (req, res) => {
  const { boxId } = req.params;

  if (!pendingCommands.has(boxId)) {
    return res.json(null);
  }

  return res.json(pendingCommands.get(boxId));
});

/**
 * POST /api/boxes/:boxId/commands/:commandId/ack
<<<<<<< HEAD
 * Agent bevestigt uitvoering → command wordt verwijderd
=======
 * Verwijdert command na uitvoering
>>>>>>> 4224a44 (Simplify commands: open/close only create pending command)
 */
router.post("/:boxId/commands/:commandId/ack", (req, res) => {
  const { boxId, commandId } = req.params;
  const { result, shutterState } = req.body;

  console.log("COMMAND ACK:", {
    boxId,
    commandId,
    result,
    shutterState
  });

  pendingCommands.delete(boxId);

  res.json({ ok: true });
});

// ------------------------------------------------------
// BOX ROUTES
// ------------------------------------------------------

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
<<<<<<< HEAD
    res.json(await boxesService.getAll());
  } catch (err) {
    console.error(err);
=======
    const boxes = await boxesService.getAll();
    res.json(boxes);
  } catch (err) {
    console.error("Fout bij ophalen boxen:", err);
>>>>>>> 4224a44 (Simplify commands: open/close only create pending command)
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);
<<<<<<< HEAD
    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }
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
// COMMANDS (Firestore-based)
// ------------------------------------------------------

/**
 * GET /api/boxes/:boxId/commands
 * Agent haalt huidig pending command op
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

// ------------------------------------------------------
// BOX ROUTES
// ------------------------------------------------------

router.get("/", async (req, res) => {
  try {
    res.json(await boxesService.getAll());
  } catch {
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);
    if (!box) return res.status(404).json({ error: "Box niet gevonden" });
    res.json(box);
  } catch {
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/open
 * Maakt OPEN command aan (pending)
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

    res.json({ ok: true, command: "open", boxId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 * Maakt CLOSE command aan (pending)
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

    res.json({ ok: true, command: "close", boxId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
