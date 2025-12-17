// api/src/routes/orgBoxDevice.js
import { Router } from "express";
import { db } from "../db.js";
import * as commandsService from "../services/commandsService.js";
import * as boxesService from "../services/boxesService.js";

const router = Router();

function nowMs() {
  return Date.now();
}

function getOrgBoxFromReq(req) {
  // Dit file wordt meestal gemount op iets als:
  // /api/orgs/:orgId/boxes/:boxId/device
  // Als orgId niet bestaat, werken we boxId-only.
  const orgId = req.params.orgId || null;
  const boxId = req.params.boxId;
  return { orgId, boxId };
}

function deviceRef({ orgId, boxId }) {
  if (orgId) return db.collection("orgs").doc(orgId).collection("boxes").doc(boxId).collection("devices").doc("primary");
  return db.collection("boxes").doc(boxId).collection("devices").doc("primary");
}

// 1) Device heartbeat en status
router.post("/status", async (req, res) => {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);
    const status = req.body;

    if (!status || typeof status !== "object") {
      return res.status(400).json({ ok: false, message: "Ongeldige status payload." });
    }

    await deviceRef({ orgId, boxId }).set(
      {
        ...status,
        lastSeenAt: nowMs()
      },
      { merge: true }
    );

    return res.json({ ok: true, message: "Status ontvangen." });
  } catch (e) {
    console.error("device status error", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout." });
  }
});

// 2) Device poll: volgende command
async function handlePoll(req, res) {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;

    const cmd = await commandsService.popNextCommand({ orgId, boxId, deviceId });

    return res.json({
      ok: true,
      command: cmd || null
    });
  } catch (e) {
    console.error("poll command error", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout." });
  }
}

router.get("/commands", handlePoll);
router.get("/commands/next", handlePoll);

// 3) Resultaat van command
router.post("/commands/:commandId/result", async (req, res) => {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);
    const commandId = req.params.commandId;

    const ok = !!req.body?.ok;
    const error = req.body?.error || null;
    const result = req.body?.result || null;

    await commandsService.submitResult({ orgId, boxId, commandId, ok, error, result });

    // Status consistency: pas box status aan als het echt gelukt is
    if (ok) {
      const cmdType = result?.type || req.body?.type || null;

      // Als agent result.type niet stuurt, halen we de command op
      let type = cmdType;
      if (!type) {
        const ref = orgId
          ? db.collection("orgs").doc(orgId).collection("boxes").doc(boxId).collection("commands").doc(commandId)
          : db.collection("boxes").doc(boxId).collection("commands").doc(commandId);

        const snap = await ref.get();
        type = snap.exists ? (snap.data()?.type || null) : null;
      }

      if (type === "open") await boxesService.setBoxFinalState(boxId, "open");
      else if (type === "close") await boxesService.setBoxFinalState(boxId, "closed");
      else await boxesService.setBoxFinalState(boxId, "open"); // fallback
    } else {
      await boxesService.setBoxFinalState(boxId, "error", { lastError: String(error || "unknown error") });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("command result error", e);
    return res.status(500).json({ ok: false, message: "Interne serverfout." });
  }
});

export default router;
