import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("API gestart op poort", PORT);
});
