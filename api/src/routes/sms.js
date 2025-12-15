// api/src/routes/sms.js

import { Router } from "express";

import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";
import { handleEvent } from "../state/gridboxStateMachine.js";
import { EVENTS } from "../state/events.js";

const router = Router();

/**
 * Normaliseer telefoonnummer
 */
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

/**
 * POST /api/sms/inbound
 * Enige ingang voor SMS of simulator
 */
router.post("/inbound", async (req, res) => {
  try {
    console.log("📩 SMS inbound:", req.body);

    const from = normalizePhone(req.body.From);
    const bodyRaw = req.body.Body || "";
    const body = bodyRaw.trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // Enkel exacte commando's
    let eventType = null;
    if (body === "open") eventType = EVENTS.SMS_OPEN;
    if (body === "close") eventType = EVENTS.SMS_CLOSE;

    if (!eventType) {
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

    // Box ophalen
    const box = await boxesService.getById(share.boxId);
    if (!box) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Box niet beschikbaar.</Message></Response>`);
    }

    // State-machine beslist
    const result = await handleEvent({
      box,
      event: { type: eventType },
      context: {
        phone: from,
        source: "sms"
      }
    });

    console.log("🧠 State-machine:", result);

    // Afhandeling
    if (result.action === "IGNORE") {
      // Stil negeren, geen verwarrende antwoorden
      return res.sendStatus(200);
    }

    if (result.action === "REJECT") {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Actie momenteel niet toegestaan.</Message></Response>`
        );
    }

    // OPEN
    if (result.action === "OPEN") {
      const r = await boxesService.openBox(share.boxId, "sms", from);
      if (!r.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Openen mislukt.</Message></Response>`
          );
      }

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt geopend.</Message></Response>`
        );
    }

    // CLOSE
    if (result.action === "CLOSE") {
      const r = await boxesService.closeBox(share.boxId, "sms", from);
      if (!r.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Sluiten mislukt.</Message></Response>`
          );
      }

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt gesloten.</Message></Response>`
        );
    }

    // Fallback
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ sms route fout:", err);
    return res
      .type("text/xml")
      .send(`<Response><Message>Interne fout.</Message></Response>`);
  }
});

export default router;
