// api/src/index.js

const express = require("express");
const cors = require("cors");

// Routers
const boxesRouter = require("./routes/boxes");
const sharesRouter = require("./routes/shares");
const smsRouter = require("./routes/smsWebhook");

const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ------------------------------------------------------
// Healthcheck
// ------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

// ------------------------------------------------------
// Routes
// ------------------------------------------------------
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/sms-webhook", smsRouter);

// ------------------------------------------------------
// Start Server
// ------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`Gridbox API luistert op http://${HOST}:${PORT}`);
});
