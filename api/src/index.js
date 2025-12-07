const express = require("express");
const app = express();

app.use(express.json());

// Healthcheck (test of de API draait)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Placeholder voor de Raspberry Pi
app.get("/api/boxes/:id/commands/next", (req, res) => {
  const { id } = req.params;
  res.json({ boxId: id, command: null });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Gridbox API luistert op poort ${port}`);
});
