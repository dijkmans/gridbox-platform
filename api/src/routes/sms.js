// api/src/routes/sms.js

import { Router } from "express";
import * as sharesService from "../services/sharesService.js";
import * as boxesService from "../services/boxesService.js";

const router = Router();

// telefoon normaliseren
function normalizePhone(number) {
  if (!number) return null;
  return String(number).replace(/\s+/g, "").trim();
}

router.post("/inbound", async (req, res) => {
  try {
    console.log("📩 Inkomende SMS webhook");
    console.log("From:", req.body.From);
    console.log("Body:", req.body.Body);

    const from = normalizePhone(req.body.From);
    const body = (req.body.Body || "").trim().toUpperCase();

    if (!from) {
      return res.status(200).type("text/xml").send(`
<Response>
  <Message>Ongeldig telefoonnummer.</Message>
</Response>
      `.trim());
    }

    // ✅ JUISTE FUNCTIE
    const share = await sharesService.findActiveShareByPhone(from);

    if (!share) {
      return res.status(200).type("text/xml").send(`
<Response>
  <Message>Geen actieve toegang gevonden voor dit nummer.</Message>
</Response>
      `.trim());
    }

    if (body !== "OPEN") {
      return res.status(200).type("text/xml").send(`
<Response>
  <Message>Ongeldig commando. Typ exact: OPEN</Message>
</Response>
      `.trim());
    }

    const result = await boxesService.openBox(share.boxId);

    if (!result.success) {
      return res.status(200).type("text/xml").send(`
<Response>
  <Message>De box kon niet geopend worden.</Message>
</Response>
      `.trim());
    }

    return res.status(200).type("text/xml").send(`
<Response>
  <Message>De box is geopend.</Message>
</Response>
    `.trim());

  } catch (err) {
    console.error("❌ Fout in SMS webhook:", err);

    return res.status(200).type("text/xml").send(`
<Response>
  <Message>Interne fout. Probeer later opnieuw.</Message>
</Response>
    `.trim());
  }
});

export default router;
