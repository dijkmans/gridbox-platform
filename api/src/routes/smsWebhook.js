// api/src/routes/smsWebhook.js

import { Router } from "express";

import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";
import { updateState } from "../services/stateService.js";

import { handleEvent } from "../state/gridboxStateMachine.js";
import { EVENTS } from "../state/events.js";

const router = Router();

function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

router.post("/", async (req, res) => {
  try {
    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toLowerCase();

    if (!from) {
      return reply(res, "Ongeldig nummer.");
    }

    const isOpen = body === "open";
    const isClose = body === "close";

    if (!isOpen && !isClose) {
      return reply(res, "Ongeldig commando. Stuur OPEN of CLOSE.");
    }

    const share = await sharesService.findActiveShareByPhone(from);
    if (!share) {
      return reply(res, "Geen toegang voor dit nummer.");
    }

    const box = await boxesService.getById(share.boxId);
    if (!box) {
      return reply(res, "Gridbox niet beschikbaar.");
    }

    const eventType = isOpen ? EVENTS.SMS_OPEN : EVENTS.SMS_CLOSE;

    const result = await handleEvent({
      box,
      event: { type: eventType }
    });

    if (result.action === "IGNORE") {
      return res.sendStatus(200);
    }

    if (result.action === "REJECT") {
      return reply(res, "Actie momenteel niet toegestaan.");
    }

    if (result.nextState) {
      await updateState(share.boxId, {
        ...result.nextState,
        requestedBy: from,
        source: "sms"
      });
    }

    if (result.action === "OPEN") {
      await boxesService.openBox(share.boxId, "sms", from);
      return reply(res, "Gridbox wordt geopend.");
    }

    if (result.action === "CLOSE") {
      await boxesService.closeBox(share.boxId, "sms", from);
      return reply(res, "Gridbox wordt gesloten.");
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ smsWebhook fout:", err);
    return reply(res, "Technische fout. Probeer later opnieuw.");
  }
});

function reply(res, text) {
  return res
    .type("text/xml")
    .send(`<Response><Message>${text}</Message></Response>`);
}

export default router;
