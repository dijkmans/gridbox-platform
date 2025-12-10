// api/src/routes/shares.js

const express = require("express");
const router = express.Router();

const {
  createShare,
  listSharesForBox,
  findActiveShare,
  generateCode
} = require("../services/sharesService");

// -------------------------------------------------------------
// Helper: Validate request data
// -------------------------------------------------------------
function validateShareInput(boxId, phoneNumber) {
  if (!boxId || typeof boxId !== "string") {
    return "boxId is verplicht en moet een string zijn";
  }
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return "phoneNumber is verplicht en moet een string zijn";
  }
  return null;
}

// -------------------------------------------------------------
// POST /api/shares
// Nieuwe share aanmaken (toegangscode genereren)
// -------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    const error = validateShareInput(boxId, phoneNumber);
    if (error) {
      return res.status(400).json({ error });
    }

    const share = {
      boxId,
      phoneNumber,
      code: generateCode(),
      status: "active",
      createdAt: new Date().toISOString()
    };

    const saved = await createShare(share);

    console.log(`Share aangemaakt voor box ${boxId}, nummer ${phoneNumber}`);

    return res.status(201).json(saved);
  } catch (err) {
    console.error("Fout bij aanmaken share:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// -------------------------------------------------------------
// POST /api/shares/verify
// Check of een telefoonnummer toegang heeft tot een box
// -------------------------------------------------------------
router.post("/verify", async (req, res) => {
  try {
    const { boxId, phoneNumber } = req.body;

    const error = validateShareInput(boxId, phoneNumber);
    if (error) {
      return res.status(400).json({ error });
    }

    const share = await findActiveShare(boxId, phoneNumber);

    if (!share) {
      return res.status(404).json({
        allowed: false,
        reason: "no-active-share"
      });
    }

    console.log(`Share toegestaan voor ${phoneNumber} op box ${boxId}`);

    return res.json({
      allowed: true,
      shareId: share.id,
      boxId: share.boxId,
      phoneNumber: share.phoneNumber,
      code: share.code,
      status: share.status
    });
  } catch (err) {
    console.error("Fout bij verify:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

// -------------------------------------------------------------
// GET /api/shares/box/:boxId
// Alle shares ophalen voor één box
// -------------------------------------------------------------
router.get("/box/:boxId", async (req, res) => {
  try {
    const { boxId } = req.params;

    const shares = await listSharesForBox(boxId);

    return res.json(shares);
  } catch (err) {
    console.error("Fout bij ophalen shares voor box:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
});

module.exports = router;
