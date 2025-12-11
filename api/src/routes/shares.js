const express = require("express");
const router = express.Router();
const { db } = require("../firebase");

// -------------------------------------------------------------
// Helper: Code genereren (4 cijfers)
// -------------------------------------------------------------
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// -------------------------------------------------------------
// Helper: Input controleren
// -------------------------------------------------------------
function validateShareInput(boxId, phoneNumber) {
  if (!boxId || typeof boxId !== "string") {
    return "boxId is verplicht en moet een tekst zijn";
  }
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return "phoneNumber is verplicht en moet een tekst zijn";
  }
  return null;
}

// -------------------------------------------------------------
// POST /api/shares
// Nieuwe share aanmaken
// -------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { boxId, phoneNumber, validUntil } = req.body;

    const error = validateShareInput(boxId, phoneNumber);
    if (error) {
      return res.status(400).json({ error });
    }

    if (!validUntil) {
      return res.status(400).json({ error: "validUntil is verplicht" });
    }

    const now = new Date();
    const until = new Date(validUntil);

    const share = {
      boxId,
      phoneNumber,
      code: generateCode(),
      status: "pending",
      validFrom: now,
      validUntil: until,
      createdAt: now
    };

    const docRef = await db.collection("shares").add(share);

    console.log(`Share aangemaakt voor box ${boxId} voor nummer ${phoneNumber}`);

    return res.status(201).json({
      id: docRef.id,
      ...share
    });

  } catch (err) {
    console.error("Fout bij aanmaken share:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// -------------------------------------------------------------
// POST /api/shares/verify
// Controleren of een klant een geldige share heeft
// -------------------------------------------------------------
router.post("/verify", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    const error = validateShareInput(boxId, phoneNumber);
    if (error) {
      return res.status(400).json({ error });
    }

    const now = new Date();

    const snapshot = await db.collection("shares")
      .where("boxId", "==", boxId)
      .where("phoneNumber", "==", phoneNumber)
      .where("validFrom", "<=", now)
      .where("validUntil", ">=", now)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        allowed: false,
        reason: "geen actieve share gevonden"
      });
    }

    const doc = snapshot.docs[0];
    const share = { id: doc.id, ...doc.data() };

    console.log(`Share toegestaan voor ${phoneNumber} op box ${boxId}`);

    return res.json({
      allowed: true,
      ...share
    });

  } catch (err) {
    console.error("Fout bij verify:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// -------------------------------------------------------------
// GET /api/shares/box/:boxId
// Alle shares voor één box ophalen
// -------------------------------------------------------------
router.get("/box/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    const snapshot = await db.collection("shares")
      .where("boxId", "==", boxId)
      .get();

    const shares = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(shares);

  } catch (err) {
    console.error("Fout bij ophalen shares:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

module.exports = router;
