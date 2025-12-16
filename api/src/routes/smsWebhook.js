import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

/**
 * Telefoonnummer normaliseren
 * - verwijdert spaties
 * - behoudt +
 */
function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

/**
 * POST /api/sms
 * Enige ingang voor:
 * - echte SMS (Twilio style: form-urlencoded)
 * - simulator (JSON)
 */
router.post("/", async (req, res) => {
  try {
    // --------------------------------------------------
    // 1. Input normaliseren (Twilio + simulator)
    // --------------------------------------------------

    const rawFrom =
      req.body.From ||
      req.body.from ||
      null;

    const rawBody =
      req.body.Body ||
      req.body.body ||
      "";

    const from = normalizePhone(rawFrom);
    const body = rawBody.trim().toLowerCase();

    console.log("📩 SMS inbound:", { from, body });

    if (!from) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>Ongeldig nummer.</Message>
          </Response>
        `);
    }

    // --------------------------------------------------
    // 2. Commando parseren
    // verwacht: "open 3" of "close 3"
    // --------------------------------------------------

    const parts = body.split(/\s+/);
    const command = parts[0];
    const boxNumber = parts[1];

    if (
      !["open", "close"].includes(command) ||
      !boxNumber ||
      isNaN(boxNumber)
    ) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>
              Gebruik: OPEN &lt;nummer&gt; of CLOSE &lt;nummer&gt;.
            </Message>
          </Response>
        `);
    }

    const boxNr = Number(boxNumber);

    // --------------------------------------------------
    // 3. Actieve share zoeken (nummer + boxnummer)
    // --------------------------------------------------

    const share =
      await sharesService.findActiveShareByPhoneAndBox(
        from,
        boxNr
      );

    if (!share) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>
              Geen toegang tot Gridbox ${boxNr}.
            </Message>
          </Response>
        `);
    }

    // --------------------------------------------------
    // 4. Box ophalen
    // --------------------------------------------------

    const box = await boxesService.getById(share.boxId);

    if (!box) {
      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>
              Gridbox ${boxNr} niet gevonden.
            </Message>
          </Response>
        `);
    }

    // --------------------------------------------------
    // 5. OPEN
    // --------------------------------------------------

    if (command === "open") {
      const result = await boxesService.openBox(
        share.boxId,
        "sms",
        from
      );

      if (!result || !result.success) {
        return res
          .status(200)
          .type("text/xml")
          .send(`
            <Response>
              <Message>
                Gridbox ${boxNr} kan niet worden geopend.
              </Message>
            </Response>
          `);
      }

      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>
              Gridbox ${boxNr} wordt geopend.
            </Message>
          </Response>
        `);
    }

    // --------------------------------------------------
    // 6. CLOSE
    // --------------------------------------------------

    if (command === "close") {
      const result = await boxesService.closeBox(
        share.boxId,
        "sms",
        from
      );

      if (!result || !result.success) {
        return res
          .status(200)
          .type("text/xml")
          .send(`
            <Response>
              <Message>
                Gridbox ${boxNr} kan niet worden gesloten.
              </Message>
            </Response>
          `);
      }

      return res
        .status(200)
        .type("text/xml")
        .send(`
          <Response>
            <Message>
              Gridbox ${boxNr} wordt gesloten.
            </Message>
          </Response>
        `);
    }

    // fallback
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ smsWebhook error:", err);

    return res
      .status(200)
      .type("text/xml")
      .send(`
        <Response>
          <Message>
            Er ging iets mis. Probeer later opnieuw.
          </Message>
        </Response>
      `);
  }
});

export default router;
