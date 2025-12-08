// ===========================================
// MOCK BACKEND SERVER
// Voor lokale demo van Gridbox frontend
// ===========================================
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(cors());

// Demo data laden
const demo = JSON.parse(fs.readFileSync("./demoData.json", "utf8"));

// -------------------------------------------
// LOGIN
// -------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "demo" && password === "demo") {
    return res.json({
      token: "mock-token-123",
      tenant: {
        id: "gridbox-demo",
        brandName: "Gridbox DEMO",
        stylesheet: null
      }
    });
  }

  return res.status(401).json({ error: "Invalid login" });
});

// -------------------------------------------
// BOXES
// -------------------------------------------
app.get("/api/boxes", (req, res) => {
  res.json(demo.groups);
});

// -------------------------------------------
// SHARES
// -------------------------------------------
app.get("/api/boxes/:id/shares", (req, res) => {
  const id = req.params.id;
  const box = findBox(id);
  return res.json(box?.shares || []);
});

app.post("/api/boxes/:id/shares", (req, res) => {
  const id = req.params.id;
  const box = findBox(id);
  if (!box) return res.status(404).json({ error: "Not found" });

  const share = {
    time: new Date().toLocaleTimeString(),
    phone: req.body.phone,
    comment: req.body.comment,
    status: req.body.authorized ? "authorized" : "ok"
  };

  box.shares.push(share);
  res.json({ success: true });
});

// -------------------------------------------
// EVENTS
// -------------------------------------------
app.get("/api/boxes/:id/events", (req, res) => {
  const box = findBox(req.params.id);
  return res.json(box?.events || []);
});

// -------------------------------------------
// PICTURES
// -------------------------------------------
app.get("/api/boxes/:id/pictures", (req, res) => {
  const box = findBox(req.params.id);
  return res.json(box?.pictures || []);
});

// -------------------------------------------
// PLANNER
// -------------------------------------------
app.get("/api/planner/:group", (req, res) => {
  // Eenvoudige mock: altijd lege lijst
  res.json([]);
});

// -------------------------------------------
// Helpers
// -------------------------------------------
function findBox(id) {
  for (const g of demo.groups) {
    for (const b of g.boxes) {
      if (b.id === id) return b;
    }
  }
  return null;
}

// -------------------------------------------
// Server starten
// -------------------------------------------
const PORT = 3001;
app.listen(PORT, () => {
  console.log("Mock backend running on http://localhost:" + PORT);
});
