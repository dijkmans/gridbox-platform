// api/src/routes/shares.js

const express = require("express");
const router = express.Router();

// Services (later Firestore, nu mock of echte db-functies)
const {
  createShare,
  listSharesForBox,
  findActiveShare
} = require("../services/sharesService");

// Genereer een eenvoudige 6-cijferige toegangscode
function generateShareCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------
// POST /api/shares
// Maak een nieuwe share aan voor een box + telefoonnummer
// ---------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    const newShare = {
      boxId,
      phoneNumber,
      code: generateShareCode(),
      createdAt: new Date().toISOString()
    };

    const saved = await createShare(newShare);

    res.status(201).json(saved);
  } catch (error) {
    console.error("Fout bij aanmaken share:", error);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// POST /api/shares/verify
// Controleer of deze gebruiker toegang heeft tot de box
// ---------------------------------------------------------
router.post("/verify", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    const share = await findActiveShare(boxId, phoneNumber);

    if (!share) {
      return res.status(404).json({
        allowed: false,
        reason: "no-active-share"
      });
    }

    res.json({
      allowed: true,
      shareId: share.id,
      boxId: share.boxId,
      phoneNumber: share.phoneNumber,
      code: share.code,
      status: share.status || "active"
    });
  } catch (error) {
    console.error("Fout bij verify share:", error);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// ---------------------------------------------------------
// GET /api/boxes/:boxId/shares
// Haal alle shares op voor een specifieke box
// ---------------------------------------------------------
async function listSharesForBoxHandler(req, res) {
  try {
    const { boxId } = req.params;
    const shares = await listSharesForBox(boxId);
    res.json(shares);
  } catch (error) {
    console.error("Fout bij ophalen shares:", error);
    res.status(500).json({ error: "Interne serverfout" });
  }
}

module.exports = {
  router,
  listSharesForBoxHandler
};
