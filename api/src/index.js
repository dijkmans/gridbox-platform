import express from "express";
import cors from "cors";

// Routes
import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";
import sharesRouter from "./routes/shares.js";
import internalJobsRouter from "./routes/internalJobs.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------

app.use(cors());
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ------------------------------------------------------
// Healthcheck
// ------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "gridbox-api"
  });
});

// ------------------------------------------------------
// Routes
// ------------------------------------------------------

app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);
app.use("/api/sms", smsRouter);
app.use("/api/shares", sharesRouter);

// interne jobs (waarschuwingen, later cleanup, enz.)
app.use("/api/internal", internalJobsRouter);

// ------------------------------------------------------
// Fallback
// ------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route niet gevonden"
  });
});

// ------------------------------------------------------
// Start
// ------------------------------------------------------

app.listen(PORT, () => {
  console.log("🚀 Gridbox API gestart");
  console.log(`📡 Luistert op poort ${PORT}`);
});
