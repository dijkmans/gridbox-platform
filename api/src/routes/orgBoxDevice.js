// api/src/routes/orgBoxDevice.js
import { Router } from "express";
import { db } from "../db.js";
import * as commandsService from "../services/commandsService.js";
import * as boxesService from "../services/boxesService.js";

const router = Router({ mergeParams: true });

function nowMs() {
  return Date.now();
}

function getOrgBoxFromReq(req) {
  const orgId = req.params.orgId || null;
  const boxId = req.params.boxId || null;
  return { orgId, boxId };
}

function deviceRef({ orgId, boxId }) {
  if (!db) throw new Error("db is null (Firestore niet geïnitialiseerd)");
  if (orgId) {
    return db
      .collection("orgs")
      .doc(orgId)
      .collection("boxes")
      .doc(boxId)
      .collection("devices")
      .doc("primary");
  }
  return db.collection("boxes").doc(boxId).collection("devices").doc("primary");
}

function internalError(res, req, err, context) {
  const details = String(err?.message || err || "unknown error");
  const stack = err?.stack ? String(err.stack) : "";

  console.error(`❌ ${context}: ${details}`);
  if (stack) console.error(stack);

  if (req.headers["x-debug"] === "1") {
    return res.status(500).json({ ok: false, message: "Interne serverfout.", details });
  }

  return res.status(500).json({ ok: false, message: "Interne serverfout." });
}

router.post("/status", async (req, res) => {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);

    if (!boxId) return res.status(400).json({ ok: false, message: "boxId ontbreekt." });
    if (!db) throw new Error("db is null (Firestore niet geïnitialiseerd)");

    const status = req.body;
    if (!status || typeof status !== "object") {
      return res.status(400).json({ ok: false, message: "Ongeldige status payload." });
    }

    await deviceRef({ orgId, boxId }).set(
      { ...status, lastSeenAt: nowMs() },
      { merge: true }
    );

    return res.json({ ok: true, message: "Status ontvangen." });
  } catch (e) {
    return internalError(res, req, e, "device status error");
  }
});

async function handlePoll(req, res) {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);

    if (!boxId) return res.status(400).json({ ok: false, message: "boxId ontbreekt." });
    if (!db) throw new Error("db is null (Firestore niet geïnitialiseerd)");

    const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;

    const cmd = await commandsService.popNextCommand({ orgId, boxId, deviceId });

    return res.json({ ok: true, command: cmd || null });
  } catch (e) {
    return internalError(res, req, e, "poll command error");
  }
}

router.get("/commands", handlePoll);
router.get("/commands/next", handlePoll);

router.post("/commands/:commandId/result", async (req, res) => {
  try {
    const { orgId, boxId } = getOrgBoxFromReq(req);

    if (!boxId) return res.status(400).json({ ok: false, message: "boxId ontbreekt." });
    if (!db) throw new Error("db is null (Firestore niet geïnitialiseerd)");

    const commandId = req.params.commandId;

    const ok = !!req.body?.ok;
    const error = req.body?.error || null;
    const result = req.body?.result || null;

    await commandsService.submitResult({ orgId, boxId, commandId, ok, error, result });

    if (ok) {
      const ref = orgId
        ? db.collection("orgs").doc(orgId).collection("boxes").doc(boxId).collection("commands").doc(commandId)
        : db.collection("boxes").doc(boxId).collection("commands").doc(commandId);

      const snap = await ref.get();
      const type = snap.exists ? (snap.data()?.type || null) : null;

      if (type === "open") await boxesService.setBoxFinalState(boxId, "open");
      else if (type === "close") await boxesService.setBoxFinalState(boxId, "closed");
      else await boxesService.setBoxFinalState(boxId, "open");
    } else {
      await boxesService.setBoxFinalState(boxId, "error", {
        lastError: String(error || "unknown error")
      });
    }

    return res.json({ ok: true });
  } catch (e) {
    return internalError(res, req, e, "command result error");
  }
});

export default router;

