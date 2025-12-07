// src/index.js
const express = require("express");
const { getBoxById } = require("./boxes");
const {
  createShare,
  getSharesForBox,
  verifyShare,
} = require("./shares");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// één box ophalen
app.get("/api/boxes/:id", async (req, res, next) => {
  try {
    const box = await getBoxById(req.params.id);
    if (!box) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }
    res.json(box);
  } catch (err) {
    next(err);
  }
});

// share aanmaken: koppelt gsm aan gridbox
app.post("/api/shares", async (req, res, next) => {
  try {
    const { boxId, phoneNumber } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    const share = await createShare(boxId, phoneNumber);
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
});

// NIEUW: alle shares van een box
app.get("/api/boxes/:boxId/shares", async (req, res, next) => {
  try {
    const { boxId } = req.params;
    const shares = await getSharesForBox(boxId);
    res.json(shares);
  } catch (err) {
    next(err);
  }
});

// NIEUW: verify voor Pi / WhatsApp
app.post("/api/shares/verify", async (req, res, next) => {
  try {
    const { boxId, phoneNumber, code } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    const result = await verifyShare(boxId, phoneNumber, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// algemene foutafhandeling
app.use((err, req, res, next) => {
  console.error("Onverwachte fout in API:", err);
  res.status(500).json({ error: "Interne serverfout" });
});

// server starten
app.listen(PORT, () => {
  console.log(`Gridbox API luistert op poort ${PORT}`);
});

module.exports = app;
