// api/src/index.js

const express = require("express");
const cors = require("cors");

const { getBoxHandler } = require("./boxes");
const {
  router: sharesRouter,
  listSharesForBoxHandler,
} = require("./shares");

const app = express();

// Cloud Run geeft deze variabelen automatisch mee
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Boxes
app.get("/api/boxes/:boxId", getBoxHandler);
app.get("/api/boxes/:boxId/shares", listSharesForBoxHandler);

// Shares (aanmaken + verify)
app.use("/api/shares", sharesRouter);

// BELANGRIJK: luister op 0.0.0.0 zodat Cloud Run verkeer kan doorgeven
app.listen(PORT, HOST, () => {
  console.log(`Gridbox API luistert op http://${HOST}:${PORT}`);
});
