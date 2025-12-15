// api/src/routes/sms.js
import { Router } from "express";
import * as sharesService from "../services/sharesService.js";
import * as boxesService from "../services/boxesService.js";

const router = Router();

function normalizePhone(number) {
  if (!number) return null;
  return String(number).replace(/\s+/g, "").trim();
}

router.post("/inbound", async (req, res) => {
  try {
    console.log("📩 Inkomende SMS");
    console.log("From:", req.body.From);
    console.log("Body:", req.body.Body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toUpperCase();

    if (!from) {
      return res.type("text/xml").send(
        `<Response><Message>Ongeldig nummer.</Message></Response>`
      );
    }

    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res.type("text/xml").send(
        `<Response><Message>Geen actieve toegang gevonden voor dit nummer.</Message></Response>`
      );
    }

    if (body !== "OPEN") {
      return res.type("text/xml").send(
        `<Response><Message>Ongeldig commando. Typ exact: OPEN</Message></Response>`
      );
    }

    await boxesService.openBox(share.boxId, {
      source: "sms",
      phone: from
    });

    return res.type("text/xml").send(
      `<Response><Message>De box is geopend.</Message></Response>`
    );

  } catch (err) {
    console.error("❌ SMS fout:", err);
    return res.type("text/xml").send(
      `<Response><Message>Interne fout.</Message></Response>`
    );
  }
});

export default router;
