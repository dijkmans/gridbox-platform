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
 * Enige ingang voor SMS / simulator
 */
router.post("/", async (req, res) => {
  try {
    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toLowerCase();

    if (!from) {
      return res
        .type("text/xml")
        .send(`<Response><Message>Ongeldig nummer.</Message></Response>`);
    }

    const isOpen = body === "open";
    const isClose = body === "close";

    if (!isOpen && !isClose) {
      return res
        .type("text/xml")
        .send(
          `<Response><Message>Ongeldig commando. Gebruik OPEN of CLOSE.</Message></Response>`
        );
    }

    // 1. Actieve share zoeken
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
        .send(`<Response><Message>Box niet gevonden.</Message></Response>`);
    }

    // 3. OPEN
    if (isOpen) {
      const result = await boxesService.openBox(
        share.boxId,
        "sms",
        from
      );

      if (!result.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Gridbox kan niet worden geopend.</Message></Response>`
          );
      }

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt geopend.</Message></Response>`
        );
    }

    // 4. CLOSE
    if (isClose) {
      const result = await boxesService.closeBox(
        share.boxId,
        "sms",
        from
      );

      if (!result.success) {
        return res
          .type("text/xml")
          .send(
            `<Response><Message>Gridbox kan niet worden gesloten.</Message></Response>`
          );
      }

      return res
        .type("text/xml")
        .send(
          `<Response><Message>Gridbox wordt gesloten.</Message></Response>`
        );
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ smsWebhook error:", err);
    return res
      .type("text/xml")
      .send(`<Response><Message>Er ging iets mis.</Message></Response>`);
  }
});

export default router;
