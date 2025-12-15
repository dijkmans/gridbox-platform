import express from "express";
import cors from "cors";

// Routes
import boxesRouter from "./routes/boxes.js";
// shares tijdelijk uitgeschakeld

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "gridbox-api"
  });
});

app.use("/api/boxes", boxesRouter);

app.listen(PORT, () => {
  console.log(`Gridbox API listening on port ${PORT}`);
});
