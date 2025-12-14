// api/src/routes/sms.js

import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/**
 * Normaliseer telefoonnummer
 * Twilio stuurt nummers als +32..., +31...
 */
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

/**
 * POST /api/sms/inbound
 * Inkomende SMS webhook van Twilio
 */
router.post("/inbound", async (req, res) => {
  try {
    console.log("📩 Inkomende SMS webhook");
    console.log("From:", req.body.From);
    console.log("Body:", req.body.Body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toUpperCase();

    if (!from) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
<Response>
  <Message>Ongeldig telefoonnummer.</Message>
</Response>
        `.trim());
    }

    // 1. Zoek actieve share op basis van telefoonnummer
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
<Response>
  <Message>Geen actieve toegang gevonden voor dit nummer.</Message>
</Response>
        `.trim());
    }

    // 2. Alleen OPEN-commando's verwerken
    if (body !== "OPEN") {
      return res
        .status(200)
        .type("text/xml")
        .send(`
<Response>
  <Message>Ongeldig commando. Stuur OPEN om de box te openen.</Message>
</Response>
        `.trim());
    }

    // 3. Maak OPEN-command aan voor de box
    const result = await boxesService.openBox(share.boxId);

    if (!result || result.success !== true) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
<Response>
  <Message>De box kon niet geopend worden.</Message>
</Response>
        `.trim());
    }

    // 4. Succesbericht
    return res
      .status(200)
      .type("text/xml")
      .send(`
<Response>
  <Message>De box is geopend.</Message>
</Response>
      `.trim());

  } catch (err) {
    console.error("❌ Fout in SMS webhook:", err);

    return res
      .status(200)
      .type("text/xml")
      .send(`
<Response>
  <Message>Er ging iets mis. Probeer later opnieuw.</Message>
</Response>
      `.trim());
  }
});

export default router;
