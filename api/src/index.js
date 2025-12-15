import express from "express";
import cors from "cors";

// Routes
import boxesRouter from "./routes/boxes.js";
import statusRouter from "./routes/status.js";
// import sharesRouter from "./routes/shares.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------
app.use(cors());
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
// app.use("/api/shares", sharesRouter);

// ------------------------------------------------------
// Start server
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Gridbox API listening on port ${PORT}`);
});
