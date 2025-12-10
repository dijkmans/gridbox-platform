// api/src/routes/sms.js

const express = require("express");
const router = express.Router();

const {
  findActiveShare
} = require("../services/sharesService");

const boxesService = require("../services/boxesService");

// -------------------------------------------------------------
// Helpers voor Twilio antwoorden
// -------------------------------------------------------------
function twiml(message) {
  return `
    <Response>
      <Message>${message}</Message>
    </Response>
  `;
}

// -------------------------------------------------------------
// POST /api/sms-webhook
// Wordt aangesproken door Twilio bij inkomende sms
// -------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const from = req.body.From;
    const body = (req.body.Body || "").trim();

    console.log("Twilio sms ontvangen:", { from, body });

    // Voor nu: we verwachten dat de klant als bericht het boxnummer stuurt.
    const boxId = body;

    if (!boxId) {
      return res
        .status(200)
        .type("text/xml")
        .send(twiml("Ik kon geen boxnummer vinden in je bericht."));
    }

    // Zoek of deze klant een actieve share heeft voor deze box
    const share = await findActiveShare(boxId, from);

    if (!share) {
      return res
        .status(200)
        .type("text/xml")
        .send(twiml("Je hebt geen toegang tot deze box."));
    }

    // Share bestaat, dus box openen
    const openResult = await boxesService.open(boxId);

    console.log("Open resultaat:", openResult);

    return res
      .status(200)
      .type("text/xml")
      .send(twiml(`De box ${boxId} wordt geopend. Bedankt.`));
  } catch (error) {
    console.error("SMS webhook fout:", error);

    return res
      .status(200)
      .type("text/xml")
      .send(twiml("Er ging iets mis. Probeer later opnieuw."));
  }
});

module.exports = router;
