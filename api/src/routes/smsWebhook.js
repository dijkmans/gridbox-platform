// api/src/routes/smsWebhook.js

import { Router } from "express";

import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";
import { updateState } from "../services/stateService.js";

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
 * Ontvangt inkomende SMS via Twilio
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS webhook ontvangen:", req.body);

    const from = normalizePhone(req.body.From);
    const bodyRaw = req.body.Body || "";
    const body = bodyRaw.trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // Enkel OPEN en CLOSE herkennen (CLOSE is voorbereid)
    const isOpen = body.startsWith("open");
    const isClose = body.startsWith("close");

    if (!isOpen && !isClose) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Onbekend commando. Gebruik OPEN.</Message></Response>`
        );
    }

    // 1. Actieve share zoeken
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      console.log("❌ Geen actieve share voor:", from);
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang voor dit nummer.</Message></Response>`
        );
    }

    console.log("✔ Actieve share:", share);

    // 2. Box ophalen
    const box = await boxesService.getById(share.boxId);

    if (!box) {
      console.log("❌ Box niet gevonden:", share.boxId);
      return res
        .type("text/xml")
        .send(`<Response><Message>Box niet beschikbaar.</Message></Response>`);
    }

    // 3. Event bepalen
    const eventType = isOpen ? EVENTS.SMS_OPEN : EVENTS.SMS_CLOSE;

    // 4. Beslissing via state-machine
    const result = await handleEvent({
      box,
      event: { type: eventType },
      context: {
        phone: from,
        source: "sms"
      }
    });

    console.log("🧠 State-machine result:", result);

    // 5. Afhandeling
    if (result.action === "REJECT") {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang of box tijdelijk niet beschikbaar.</Message></Response>`
        );
    }

    if (result.action === "IGNORE") {
      // Stil negeren (bv. herhaald OPEN)
      return res.sendStatus(200);
    }

    if (result.action === "OPEN") {
      // State eerst zetten
      await updateState(share.boxId, {
        mode: "opening",
        reason: "sms",
        requestedBy: from
      });

      // Fysiek openen
      const openResult = await boxesService.open(share.boxId);

      if (!openResult.success) {
        console.error("❌ Open mislukt:", openResult.message);
        return res
          .type("text/xml")
          .send(
            `<Response><Message>De box kon niet worden geopend.</Message></Response>`
          );
      }

      console.log("🔓 OPEN uitgevoerd voor:", share.boxId);

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De Gridbox wordt geopend.</Message></Response>`
        );
    }

    if (result.action === "CLOSE") {
      await updateState(share.boxId, {
        mode: "closing",
        reason: "sms",
        requestedBy: from
      });

      const closeResult = await boxesService.close(share.boxId);

      if (!closeResult.success) {
        console.error("❌ Close mislukt:", closeResult.message);
        return res
          .type("text/xml")
          .send(
            `<Response><Message>De box kon niet worden gesloten.</Message></Response>`
          );
      }

      console.log("🔒 CLOSE uitgevoerd voor:", share.boxId);

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De Gridbox wordt gesloten.</Message></Response>`
        );
    }

    // Fallback
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Fout in smsWebhook:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

export default router;
