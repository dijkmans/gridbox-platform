// api/src/routes/smsWebhook.js

const express = require("express");
const router = express.Router();

const boxesService = require("../services/boxesService");
const sharesService = require("../services/sharesService");

// ---------------------------------------------------------
// Helper: telefoonnummer normaliseren
// ---------------------------------------------------------
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

// ---------------------------------------------------------
// POST /api/sms-webhook
// ---------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook ontvangen:", req.body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // -----------------------------------------------------
    // 1. Zoek share via ALLE boxen (findActiveShare werkt op boxId)
    // -----------------------------------------------------
    const allBoxes = await boxesService.getAll();

    let activeShare = null;

    for (const box of allBoxes) {
      const match = await sharesService.findActiveShare(box.id, from);
      if (match) {
        activeShare = match;
        break;
      }
    }

    if (!activeShare) {
      console.log("❌ Geen actieve share gevonden voor:", from);
      return res
        .type("text/xml")
        .send(`<Response><Message>Geen toegang voor dit nummer.</Message></Response>`);
    }

    console.log("✔ Actieve share gevonden:", activeShare);

    // -----------------------------------------------------
    // 2. Box openen (mock)
    // -----------------------------------------------------
    const openResult = await boxesService.open(activeShare.boxId);

    if (!openResult.success) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Kon box niet openen.</Message></Response>`);
    }

    console.log("🔓 Box geopend:", activeShare.boxId);

    // -----------------------------------------------------
    // 3. Antwoord terug naar Twilio
    // -----------------------------------------------------
    return res
      .type("text/xml")
      .send(`<Response><Message>De box is geopend. Veel succes!</Message></Response>`);

  } catch (err) {
    console.error("❌ Fout in sms-webhook:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

module.exports = router;
