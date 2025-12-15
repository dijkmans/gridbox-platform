// api/src/routes/smsWebhook.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/**
 * Telefoonnummer normaliseren
 */
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

/**
 * POST /api/sms-webhook
 * Ontvangt inkomende SMS via Twilio (TwiML response)
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook ontvangen:", req.body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim();

    if (!from) {
      console.log("❌ Geen geldig afzendernummer ontvangen");
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // 1. Actieve share zoeken op telefoonnummer
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      console.log("❌ Geen actieve share voor:", from);
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang voor dit nummer.</Message></Response>`
        );
    }

    console.log("✔ Actieve share gevonden:", share);

    // 2. Box openen via boxesService (nu mock)
    const openResult = await boxesService.openBox(share.boxId, "sms");

    if (!openResult.success) {
      console.log("❌ Box openen mislukt:", openResult.message);
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Fout: kon de box niet openen.</Message></Response>`
        );
    }

    console.log("🔓 Box geopend:", share.boxId);

    // 3. Twilio XML response
    return res
      .type("text/xml")
      .send(`<Response><Message>De box is geopend. Veel succes!</Message></Response>`);

  } catch (err) {
    console.error("❌ Fout in SMS-webhook:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

export default router;
