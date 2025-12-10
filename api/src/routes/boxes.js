// api/src/routes/boxes.js

const express = require("express");
const router = express.Router();

const boxesService = require("../services/boxesService");

// ---------------------------------------------------------
// GET /api/boxes
// Haal alle boxen op (mock of database)
// ---------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const boxes = await boxesService.getAll();
    return res.json(boxes);
  } catch (err) {
    console.error("Fout bij ophalen boxen:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// GET /api/boxes/:id
// Haal één specifieke box op
// ---------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const box = await boxesService.getById(req.params.id);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    return res.json(box);
  } catch (err) {
    console.error("Fout bij ophalen box:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// GET /api/boxes/:id/shares
// Haal alle shares op die gekoppeld zijn aan deze box
// ---------------------------------------------------------
router.get("/:id/shares", async (req, res) => {
  try {
    const shares = await boxesService.getShares(req.params.id);
    return res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares voor box:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// POST /api/boxes/:id/open
// Box openen (mock, later Pi-integratie)
// ---------------------------------------------------------
router.post("/:id/open", async (req, res) => {
  try {
    const result = await boxesService.open(req.params.id);
    return res.json(result);
  } catch (err) {
    console.error("Fout bij openen box:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// POST /api/boxes/:id/close
// Box sluiten (mock)
// ---------------------------------------------------------
router.post("/:id/close", async (req, res) => {
  try {
    const result = await boxesService.close(req.params.id);
    return res.json(result);
  } catch (err) {
    console.error("Fout bij sluiten box:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

module.exports = router;
