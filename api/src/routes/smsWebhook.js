// api/src/routes/smsWebhook.js
import { Router } from "express";

import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

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
      return res.type("text/xml").send(
        `<Response><Message>Ongeldig nummer.</Message></Response>`
      );
    }

    if (body !== "open" && body !== "close") {
      return res.type("text/xml").send(
        `<Response><Message>Ongeldig commando. Gebruik OPEN of CLOSE.</Message></Response>`
      );
    }

    const share = await sharesService.findActiveShareByPhone(from);
    if (!share) {
      return res.type("text/xml").send(
        `<Response><Message>Geen toegang voor dit nummer.</Message></Response>`
      );
    }

    const box = await boxesService.getById(share.boxId);
    if (!box) {
      return res.type("text/xml").send(
        `<Response><Message>Gridbox niet beschikbaar.</Message></Response>`
      );
    }

    if (body === "open") {
      await boxesService.openBox(share.boxId, "sms", from);
      return res.type("text/xml").send(
        `<Response><Message>Gridbox wordt geopend.</Message></Response>`
      );
    }

    if (body === "close") {
      await boxesService.closeBox(share.boxId, "sms", from);
      return res.type("text/xml").send(
        `<Response><Message>Gridbox wordt gesloten.</Message></Response>`
      );
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("SMS webhook error:", err);
    return res.type("text/xml").send(
      `<Response><Message>Interne fout.</Message></Response>`
    );
  }
});

export default router;
