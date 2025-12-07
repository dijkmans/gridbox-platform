// src/boxes.js
const express = require("express");
const router = express.Router();
const db = require("./db");

// Alle boxes
router.get("/", async (req, res, next) => {
  try {
    const boxes = await db.listBoxes();
    res.json(boxes);
  } catch (err) {
    next(err);
  }
});

// Eén box
router.get("/:id", async (req, res, next) => {
  try {
    const box = await db.getBoxById(req.params.id);
    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }
    res.json(box);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
