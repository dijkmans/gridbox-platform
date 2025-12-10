// api/src/index.js

const express = require("express");
const cors = require("cors");

const boxesRouter = require("./routes/boxes");
const sharesRouter = require("./routes/shares");
const smsRouter = require("./routes/sms");

const app = express();

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const API_KEY = process.env.API_KEY || "DEV_KEY_CHANGE_ME";

function isTwilioRequest(req) {
  const agent = req.headers["user-agent"] || "";
  return agent.includes("Twilio");
}

app.use((req, res, next) => {
  if (req.path === "/api/sms-webhook" || isTwilioRequest(req)) {
    return next();
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "gridbox-api" });
});

app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);
app.use("/api/sms-webhook", smsRouter);

app.listen(PORT, HOST, () => {
  console.log(`Gridbox API luistert op http://${HOST}:${PORT}`);
});
