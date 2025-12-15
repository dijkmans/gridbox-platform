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
 * POST /api/sms/inbound
 * Inkomende berichten via simulator of SMS-provider
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 Inbound SMS:", req.body);

    const from = normalizePhone(req.body.From);
    const bodyRaw = req.body.Body || "";
    const body = bodyRaw.trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    // Enkel exacte commando’s
    const isOpen = body === "open";
    const isClose = body === "close";

    if (!isOpen && !isClose) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Ongeldig commando. Stuur OPEN of CLOSE.</Message></Response>`
        );
    }

    // 1. Actieve share controleren
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Geen toegang voor dit nummer.</Message></Response>`
        );
    }

    // 2. Box ophalen
    const box = await boxesService.getById(share.boxId);

    if (!box) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Box niet beschikbaar.</Message></Response>`
        );
    }

    // 3. Event bepalen
    const eventType = isOpen ? EVENTS.SMS_OPEN : EVENTS.SMS_CLOSE;

    // 4. State-machine beslist
    const result = await handleEvent({
      box,
      event: { type: eventType },
      context: {
        phone: from,
        source: "sms"
      }
    });

    console.log("🧠 State-machine result:", result);

    if (result.action === "REJECT") {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Actie niet toegestaan.</Message></Response>`
        );
    }

    if (result.action === "IGNORE") {
      // Geen antwoord nodig
      return res.sendStatus(200);
    }

    // -------------------------
    // OPEN
    // -------------------------
    if (result.action === "OPEN") {

      if (result.nextState) {
        await updateState(share.boxId, {
          ...result.nextState,
          requestedBy: from,
          source: "sms"
        });
      }

      const openResult = await boxesService.openBox(
        share.boxId,
        "sms",
        from
      );

      if (!openResult.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Openen kon niet worden gestart.</Message></Response>`
          );
      }

      return res
        .type("text/xml")
        .send(
          `<Response><Message>De Gridbox wordt geopend.</Message></Response>`
        );
    }

    // -------------------------
    // CLOSE
    // -------------------------
    if (result.action === "CLOSE") {

      if (result.nextState) {
        await updateState(share.boxId, {
          ...result.nextState,
          requestedBy: from,
          source: "sms"
        });
      }

      const closeResult = await boxesService.closeBox(
        share.boxId,
        "sms",
        from
      );

      if (!closeResult.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Sluiten kon niet worden gestart.</Message></Response>`
          );
      }

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
      .send(
        `<Response><Message>Er ging iets mis.</Message></Response>`
      );
  }
});

export default router;
