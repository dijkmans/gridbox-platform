// src/index.js
const express = require("express");
const boxesRouter = require("./boxes");
const sharesRouter = require("./shares");

const app = express();
const PORT = process.env.PORT || 8080;

// JSON body parsing
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Routes
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Niet gevonden" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Onverwerkte fout in API:", err);
  res.status(500).json({ error: "Interne serverfout" });
});

app.listen(PORT, () => {
  console.log(`Gridbox API luistert op poort ${PORT}`);
});

module.exports = app;
