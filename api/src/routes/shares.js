import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();
const db = getFirestore();

/**
 * POST /api/shares
 * Maakt een share aan en stuurt een bevestigingsbericht
 */
router.post("/", async (req, res) => {
  try {
    const { phone, boxNumber, boxId } = req.body;

    if (!phone || boxNumber === undefined || !boxId) {
      return res.status(400).json({
        error: "phone, boxNumber en boxId zijn verplicht"
      });
    }

    const share = {
      active: true,
      phone,
      boxNumber: Number(boxNumber),
      boxId,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection("shares").add(share);

    // ----------------------------
    // SMS-bericht genereren
    // ----------------------------

    const message =
      `Gridbox ${boxNumber} is met u gedeeld. ` +
      `Antwoord op deze SMS met OPEN ${boxNumber} om de Gridbox te openen.`;

    // Voor nu: loggen (later echte SMS)
    console.log("📤 SHARE SMS:", {
      to: phone,
      message
    });

    return res.status(201).json({
      shareId: docRef.id,
      message
    });

  } catch (err) {
    console.error("❌ share create error:", err);
    return res.status(500).json({
      error: "Share kon niet worden aangemaakt"
    });
  }
});

export default router;
