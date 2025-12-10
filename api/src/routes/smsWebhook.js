// api/src/routes/smsWebhook.js

const express = require("express");
const router = express.Router();

const boxesService = require("../services/boxesService");
const sharesService = require("../services/sharesService");

// ---------------------------------------------------------
// Helper: telefoonnummer normaliseren
// Twilio levert bv. "+32470123456"
// ---------------------------------------------------------
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

// ---------------------------------------------------------
// POST /api/sms-webhook
// Ontvangt sms van Twilio en beslist wat te doen
// ---------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook ontvangen:", req.body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim();

    if (!from) {
      console.log("❌ Geen geldig afzendernummer ontvangen");
      return res.type("text/xml").send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // -----------------------------------------------------
    // 1. Controleer of dit nummer een share heeft
    // -----------------------------------------------------
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      console.log("❌ Geen actieve share gevonden voor:", from);
      return res
        .type("text/xml")
        .send(`<Response><Message>Geen toegang voor dit nummer.</Message></Response>`);
    }

    console.log("✔ Actieve share gevonden:", share);

    // -----------------------------------------------------
    // 2. Box openen (mock)
    // -----------------------------------------------------
    const openResult = await boxesService.open(share.boxId);

    if (!openResult.success) {
      console.log("❌ Mislukt om box te openen:", openResult.message);
      return res
        .type("text/xml")
        .send(`<Response><Message>Fout: kon box niet openen.</Message></Response>`);
    }

    console.log("🔓 Box geopend:", share.boxId);

    // -----------------------------------------------------
    // 3. Antwoord naar Twilio
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
