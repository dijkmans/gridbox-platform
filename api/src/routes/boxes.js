// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import { db } from "../firebase.js";

const router = Router();

// ------------------------------------------------------
// COMMANDS (Firestore-based)
// ------------------------------------------------------

router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;
    const snap = await db.collection("boxCommands").doc(boxId).get();

    if (!snap.exists) {
      return res.json(null);
    }

    return res.json(snap.data());
  } catch (err) {
    console.error("Command fetch error:", err);
    res.status(500).json(null);
  }
});

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

router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("boxCommands").doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "open",
      status: "pending",
      createdAt: new Date()
    });

    res.json({ ok: true, command: "open", boxId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("boxCommands").doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "close",
      status: "pending",
      createdAt: new Date()
    });

    res.json({ ok: true, command: "close", boxId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;

