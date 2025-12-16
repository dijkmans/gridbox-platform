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
 * Antwoord helper
 * - JSON voor simulator / interne clients
 * - XML voor Twilio
 */
function sendResponse(res, message, isSimulator) {
  if (isSimulator) {
    return res.status(200).json({
      reply: message
    });
  }

  return res
    .status(200)
    .type("text/xml")
    .send(`
      <Response>
        <Message>${message}</Message>
      </Response>
    `);
}

/**
 * POST /api/sms
 * Enige ingang voor:
 * - SMS simulator (JSON + X-Simulator header)
 * - Twilio (form-urlencoded)
 */
router.post("/", async (req, res) => {
  try {
    // --------------------------------------------------
    // 0. Bepaal kanaal
    // --------------------------------------------------

    const isSimulator =
      req.headers["x-simulator"] === "true" ||
      req.is("application/json");

    // --------------------------------------------------
    // 1. Input normaliseren
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

    console.log("📩 SMS inbound:", {
      from,
      body,
      simulator: isSimulator
    });

    if (!from) {
      return sendResponse(
        res,
        "Ongeldig nummer.",
        isSimulator
      );
    }

    // --------------------------------------------------
    // 2. Commando parsen
    // --------------------------------------------------

    const parts = body.split(/\s+/);
    const command = parts[0];
    const boxNr = parts[1];

    if (
      !["open", "close"].includes(command) ||
      !boxNr ||
      isNaN(boxNr)
    ) {
      return sendResponse(
        res,
        "Gebruik: OPEN <nummer> of CLOSE <nummer>.",
        isSimulator
      );
    }

    // --------------------------------------------------
    // 3. Share zoeken
    // --------------------------------------------------

    const share =
      await sharesService.findActiveShareByPhoneAndBox(
        from,
        boxNr
      );

    if (!share) {
      return sendResponse(
        res,
        `Geen toegang tot Gridbox ${boxNr}.`,
        isSimulator
      );
    }

    // --------------------------------------------------
    // 4. Box ophalen
    // --------------------------------------------------

    const box = await boxesService.getById(share.boxId);

    if (!box) {
      return sendResponse(
        res,
        "Gridbox niet gevonden.",
        isSimulator
      );
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
        return sendResponse(
          res,
          `Gridbox ${boxNr} kan niet worden geopend.`,
          isSimulator
        );
      }

      return sendResponse(
        res,
        `Gridbox ${boxNr} wordt geopend.`,
        isSimulator
      );
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
        return sendResponse(
          res,
          `Gridbox ${boxNr} kan niet worden gesloten.`,
          isSimulator
        );
      }

      return sendResponse(
        res,
        `Gridbox ${boxNr} wordt gesloten.`,
        isSimulator
      );
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ smsWebhook error:", err);

    return sendResponse(
      res,
      "Er ging iets mis.",
      req.headers["x-simulator"] === "true"
    );
  }
});

export default router;
