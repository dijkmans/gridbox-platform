// api/src/shares.js

const express = require("express");
const {
  createShare,
  listSharesForBox,
  findActiveShare,
} = require("./db");

const router = express.Router();

function generateShareCode() {
  // Simpele 6-cijferige code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/shares
// Maak een nieuwe share voor een box + gsm nummer
router.post("/", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    if (!boxId || !phoneNumber) {
      return res
        .status(400)
        .json({ error: "boxId en phoneNumber zijn verplicht" });
    }

    const share = await createShare({
      boxId,
      phoneNumber,
      code: generateShareCode(),
    });

    res.status(201).json(share);
  } catch (err) {
    console.error("Fout bij aanmaken share:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// POST /api/shares/verify
// Controleer of dit gsm nummer deze box mag openen
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
      return res
        .status(404)
        .json({ allowed: false, reason: "no-active-share" });
    }

    // Hier kunnen we later bv. status op "used" zetten
    res.json({
      allowed: true,
      shareId: share.id,
      boxId: share.boxId,
      phoneNumber: share.phoneNumber,
      code: share.code,
      status: share.status,
    });
  } catch (err) {
    console.error("Fout bij verify share:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// GET /api/boxes/:boxId/shares
// Lijst alle shares voor één box
async function listSharesForBoxHandler(req, res) {
  try {
    const { boxId } = req.params;
    const shares = await listSharesForBox(boxId);
    res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares voor box:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
}

module.exports = {
  router,
  listSharesForBoxHandler,
};
