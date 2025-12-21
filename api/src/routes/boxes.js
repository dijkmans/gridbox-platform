// api/src/routes/boxes.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import { db } from "../firebase.js";

const router = Router();

/*
=====================================================
COMMANDS (Firestore-based)
=====================================================
Deze routes worden gebruikt door devices (Raspberry Pi)
en door de backend om open/close-commando’s te beheren.
Deze blijven ongewijzigd.
*/

router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;
    const snap = await db.collection("boxCommands").doc(boxId).get();

    if (!snap.exists) {
      return res.json(null);
    }

    res.json(snap.data());
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

/*
=====================================================
BOX ROUTES (Frontend / Portal)
=====================================================
Deze routes zijn leidend voor de Vercel frontend.
Firestore is de enige bron van waarheid.
De frontend toont ALLEEN boxen die hier terugkomen.
Velden bestaan altijd, ook als de waarde null is.
*/

/**
 * GET /api/boxes
 * Haalt alle Gridboxen op volgens het afgesproken contract
 */
router.get("/", async (req, res) => {
  try {
    const rawBoxes = await boxesService.getAll();

    const boxes = rawBoxes.map(box => ({
      id: box.id ?? null,

      customer: box.customer ?? null,
      site: box.site ?? null,
      boxNumber: box.boxNumber ?? null,

      status: box.status ?? null,
      online: box.online ?? null,

      agentVersion: box.agentVersion ?? null,
      hardwareProfile: box.hardwareProfile ?? null,

      lastSeenMinutes: box.lastSeenMinutes ?? null,
      sharesCount: box.sharesCount ?? null
    }));

    res.json(boxes);
  } catch (err) {
    console.error("GET /api/boxes error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id
 * Haalt één Gridbox op (zelfde contract)
 */
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json({
      id: box.id ?? null,

      customer: box.customer ?? null,
      site: box.site ?? null,
      boxNumber: box.boxNumber ?? null,

      status: box.status ?? null,
      online: box.online ?? null,

      agentVersion: box.agentVersion ?? null,
      hardwareProfile: box.hardwareProfile ?? null,

      lastSeenMinutes: box.lastSeenMinutes ?? null,
      sharesCount: box.sharesCount ?? null
    });
  } catch (err) {
    console.error("GET /api/boxes/:id error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/*
=====================================================
ACTIONS (open / close)
=====================================================
Frontend stuurt intentie, device pikt command op
*/

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
    console.error("Open command error:", err);
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
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
