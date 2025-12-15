// api/src/routes/sms.js

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
 * POST /api/sms/inbound
 * Inkomende SMS of simulator-bericht
 */
router.post("/", async (req, res) => {
  try {
    console.log("📩 SMS inbound:", req.body);

    const from = normalizePhone(req.body.From);
    const bodyRaw = req.body.Body || "";
    const body = bodyRaw.trim().toUpperCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig telefoonnummer.</Message></Response>`);
    }

    // Enkel OPEN of CLOSE
    if (body !== "OPEN" && body !== "CLOSE") {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Ongeldig commando. Stuur OPEN of CLOSE.</Message></Response>`
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
        .send(`<Response><Message>Box niet gevonden.</Message></Response>`);
    }

    // OPEN
    if (body === "OPEN") {
      await boxesService.openBox(share.boxId, "sms", from);

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt geopend.</Message></Response>`
        );
    }

    // CLOSE
    if (body === "CLOSE") {
      await boxesService.closeBox(share.boxId, "sms", from);

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt gesloten.</Message></Response>`
        );
    }

    // Fallback
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Fout in sms route:", err);

    return res
      .type("text/xml")
      .send(`<Response><Message>Interne fout.</Message></Response>`);
  }
});

export default router;
