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
 * Inkomende berichten via simulator of later SMS provider
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 Inbound bericht:", req.body);

    const from = normalizePhone(req.body.From);
    const rawBody = req.body.Body || "";
    const body = rawBody.trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // Commando bepalen
    let command = null;
    if (body === "open") command = "OPEN";
    if (body === "close") command = "CLOSE";

    if (!command) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Ongeldig commando. Gebruik OPEN of CLOSE.</Message></Response>`
        );
    }

    // Actieve share zoeken
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang voor dit nummer.</Message></Response>`
        );
    }

    console.log("✔ Share gevonden:", share);

    // Commando uitvoeren
    if (command === "OPEN") {
      await boxesService.openBox(
        share.boxId,
        "sms",
        from
      );

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De box wordt geopend.</Message></Response>`
        );
    }

    if (command === "CLOSE") {
      await boxesService.closeBox(
        share.boxId,
        "sms",
        from
      );

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De box wordt gesloten.</Message></Response>`
        );
    }

    // Fallback
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Fout in inbound:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

export default router;
