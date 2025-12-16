import express from "express";
import cors from "cors";

// Routes
import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
import smsRouter from "./routes/smsWebhook.js";

const app = express();

// Cloud Run geeft altijd PORT mee
const PORT = process.env.PORT || 8080;

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------

// CORS openzetten (nodig voor simulator en externe calls)
app.use(cors());
app.options("*", cors());

// Body parsing
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

// Box acties en status
app.use("/api/boxes", boxesRouter);
app.use("/api/status", statusRouter);

// SMS ingang (simulator + Twilio)
app.use("/api/sms", smsRouter);

// ------------------------------------------------------
// Fallback voor onbekende routes
// ------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Route niet gevonden"
  });
});

// ------------------------------------------------------
// Start server
// ------------------------------------------------------

app.listen(PORT, () => {
  console.log("🚀 Gridbox API gestart");
  console.log(`📡 Luistert op poort ${PORT}`);
});
