import express from "express";
import cors from "cors";

import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "gridbox-api" });
});

app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);

app.listen(PORT, () => {
  console.log(`Gridbox API listening on port ${PORT}`);
});
