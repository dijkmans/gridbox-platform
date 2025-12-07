// src/index.js
const express = require("express");
const { getAllBoxes, getBoxById } = require("./boxes");

const app = express();
const port = process.env.PORT || 8080;

// Zodat Cloud Run healthchecks slagen
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Alle boxen
app.get("/api/boxes", async (req, res, next) => {
  try {
    const boxes = await getAllBoxes();
    res.json({ boxes });
  } catch (err) {
    next(err);
  }
});

// Eén box op id (zoals heist-1)
app.get("/api/boxes/:id", async (req, res, next) => {
  try {
    const boxId = req.params.id;
    const box = await getBoxById(boxId);

    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    res.json(box);
  } catch (err) {
    next(err);
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error("Onverwachte fout:", err);
  res.status(500).json({ error: "Interne serverfout" });
});

app.listen(port, () => {
  console.log(`Gridbox API luistert op poort ${port}`);
});

module.exports = app;

