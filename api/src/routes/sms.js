// api/src/routes/sms.js
import { Router } from "express";
import * as boxesService from "../services/boxesService.js";
import * as sharesService from "../services/sharesService.js";

const router = Router();

function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/\s+/g, "").trim();
}

function twimlMessage(text) {
  return `<Response><Message>${text}</Message></Response>`;
}

router.post("/inbound", async (req, res) => {
  try {
    console.log("📩 Inkomende SMS webhook");
    console.log("From:", req.body.From);
    console.log("Body:", req.body.Body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toUpperCase();

    if (!from) {
      return res.status(200).type("text/xml").send(twimlMessage("Ongeldig telefoonnummer."));
    }

    const share = await sharesService.findActiveShareByPhone(from);
    console.log("🔎 Share gevonden:", share ? JSON.stringify(share) : "NONE");

    if (!share) {
      return res
        .status(200)
        .type("text/xml")
        .send(twimlMessage("Geen actieve toegang gevonden voor dit nummer."));
    }

    if (body !== "OPEN" && body !== "CLOSE") {
      return res
        .status(200)
        .type("text/xml")
        .send(twimlMessage("Ongeldig commando. Stuur OPEN of CLOSE."));
    }

    if (body === "OPEN") {
      const result = await boxesService.openBox(share.boxId, "sms", from);

      if (!result || result.success !== true) {
        return res
          .status(200)
          .type("text/xml")
          .send(twimlMessage("De box kon niet geopend worden."));
      }

      return res
        .status(200)
        .type("text/xml")
        .send(twimlMessage("De box is geopend."));
    }

    if (body === "CLOSE") {
      const result = await boxesService.closeBox(share.boxId, "sms", from);

      if (!result || result.success !== true) {
        return res
          .status(200)
          .type("text/xml")
          .send(twimlMessage("De box kon niet gesloten worden."));
      }

      return res
        .status(200)
        .type("text/xml")
        .send(twimlMessage("De box is gesloten."));
    }

    return res
      .status(200)
      .type("text/xml")
      .send(twimlMessage("Ongeldig commando. Stuur OPEN of CLOSE."));
  } catch (err) {
    console.error("❌ Fout in SMS webhook:", err);
    return res
      .status(200)
      .type("text/xml")
      .send(twimlMessage("Er ging iets mis. Probeer later opnieuw."));
  }
});

export default router;
