import express from "express";
import cors from "cors";

// Bestaande routes
import boxesRouter from "./routes/boxes.js";
import sharesRouter from "./routes/shares.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "gridbox-api"
  });
});

// Actieve routes
app.use("/api/boxes", boxesRouter);
app.use("/api/shares", sharesRouter);

app.listen(PORT, () => {
  console.log(`Gridbox API listening on port ${PORT}`);
});
