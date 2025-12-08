// api/src/index.js

const express = require("express");
const cors = require("cors");

const { getBoxHandler } = require("./boxes");
const {
  router: sharesRouter,
  listSharesForBoxHandler,
} = require("./shares");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// Boxes
app.get("/api/boxes/:boxId", getBoxHandler);
app.get("/api/boxes/:boxId/shares", listSharesForBoxHandler);

// Shares
app.use("/api/shares", sharesRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gridbox API luistert op poort ${PORT}`);
});
