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
    res.json(boxes);
  } catch (err) {
    console.error("Fout bij ophalen boxen:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// GET /api/boxes/:id
// Haal één specifieke box op
// ---------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const box = await boxesService.getById(id);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    console.error("Fout bij ophalen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// GET /api/boxes/:id/shares
// Haal alle shares op die gekoppeld zijn aan deze box
// ---------------------------------------------------------
router.get("/:id/shares", async (req, res) => {
  try {
    const { id } = req.params;

    const shares = await boxesService.getShares(id);
    res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares voor box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// POST /api/boxes/:id/open
// Box openen (nu mock, later echte Pi-integratie)
// ---------------------------------------------------------
router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await boxesService.open(id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij openen box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// POST /api/boxes/:id/close
// Box sluiten (mock)
// ---------------------------------------------------------
router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await boxesService.close(id);
    res.json(result);
  } catch (err) {
    console.error("Fout bij sluiten box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

module.exports = router;
