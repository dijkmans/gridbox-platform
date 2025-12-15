// api/src/routes/smsWebhook.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

import { handleEvent } from "../state/gridboxStateMachine.js";
import { EVENTS } from "../state/events.js";

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
    const body = (req.body.Body || "").trim().toLowerCase();

    if (!from) {
      console.log("❌ Geen geldig afzendernummer ontvangen");
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // Voorlopig enkel OPEN ondersteunen
    if (!body.startsWith("open")) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Onbekend commando. Gebruik OPEN.</Message></Response>`
        );
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

    // 2. Box ophalen
    const box = await boxesService.getById(share.boxId);

    if (!box) {
      console.log("❌ Box niet gevonden:", share.boxId);
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Box niet beschikbaar.</Message></Response>`
        );
    }

    // 3. Beslissing via state-machine
    const result = await handleEvent({
      box,
      event: { type: EVENTS.SMS_OPEN },
      context: { phone: from }
    });

    if (result.action === "REJECT") {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang of box tijdelijk niet beschikbaar.</Message></Response>`
        );
    }

    if (result.action === "IGNORE") {
      // Geen antwoord nodig
      return res.sendStatus(200);
    }

    if (result.action === "OPEN") {
      // Bestaand gedrag behouden
      const openResult = await boxesService.open(share.boxId);

      if (!openResult.success) {
        console.log("❌ Box openen mislukt:", openResult.message);
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Fout: kon de box niet openen.</Message></Response>`
          );
      }

      console.log("🔓 OPEN command uitgevoerd voor:", share.boxId);

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De box gaat nu open.</Message></Response>`
        );
    }

    // Fallback (zou normaal niet gebeuren)
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Fout in SMS-webhook:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

export default router;
