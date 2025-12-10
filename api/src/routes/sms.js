// api/src/routes/sms.js

const express = require("express");
const router = express.Router();

const boxesService = require("../services/boxesService");
const sharesService = require("../services/sharesService");

function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook:", req.body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // 1. Share zoeken op telefoonnummer
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Geen toegang gevonden.</Message></Response>`);
    }

    // 2. Box openen
    const openResult = await boxesService.open(share.boxId);

    if (!openResult.success) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Fout: box kon niet openen.</Message></Response>`);
    }

    // 3. Antwoord
    return res
      .type("text/xml")
      .send(`<Response><Message>De box is geopend.</Message></Response>`);

  } catch (err) {
    console.error("SMS webhook fout:", err);
    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

module.exports = router;

