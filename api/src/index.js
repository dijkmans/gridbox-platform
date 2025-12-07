const express = require("express");
const { getAllBoxes, getBoxById } = require("./boxes");

const app = express();

app.use(express.json());

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Lijst van alle gridboxen
app.get("/api/boxes", (req, res) => {
  res.json(getAllBoxes());
});

// Detail van één gridbox
app.get("/api/boxes/:id", (req, res) => {
  const { id } = req.params;
  const box = getBoxById(id);

  if (!box) {
    return res.status(404).json({ error: "Box niet gevonden" });
  }

  res.json(box);
});

// Placeholder voor commands naar de Raspberry Pi
app.get("/api/boxes/:id/commands/next", (req, res) => {
  const { id } = req.params;
  res.json({ boxId: id, command: null });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Gridbox API luistert op poort ${port}`);
});
