// api/src/routes/boxes.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";

const router = Router();

/**
 * GET /api/boxes
 * Haal alle boxen op
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
 * GET /api/boxes/:id
 * Haal een specifieke box op
 */
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    console.error("Fout bij ophalen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id/shares
 * Haal alle shares voor deze box op
 */
router.get("/:id/shares", async (req, res) => {
  try {
    const shares = await boxesService.getShares(req.params.id);
    res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/open
 * Box openen (mock - wordt later door IoT uitgevoerd)
 */
router.post("/:id/open", async (req, res) => {
  try {
    const result = await boxesService.openBox(req.params.id, "api");
    res.json(result);
  } catch (err) {
    console.error("Fout bij openen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * POST /api/boxes/:id/close
 * Box sluiten
 */
router.post("/:id/close", async (req, res) => {
  try {
    const result = await boxesService.closeBox(req.params.id, "api");
    res.json(result);
  } catch (err) {
    console.error("Fout bij sluiten box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
