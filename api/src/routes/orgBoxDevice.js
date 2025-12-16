// api/src/routes/orgBoxDevice.js
import express from "express";
import { db, FieldValue } from "../services/firestore.js";

const router = express.Router({ mergeParams: true });

function boxRef(orgId, boxId) {
  return db.collection("organizations").doc(orgId).collection("boxes").doc(boxId);
}

function eventRef(orgId, boxId) {
  return boxRef(orgId, boxId).collection("events").doc();
}

function commandCollection(orgId, boxId) {
  return boxRef(orgId, boxId).collection("commands");
}

async function addEvent({ orgId, boxId, type, triggerType, actorType, actorId, result = "ok", errorCode = null, payload = {} }) {
  const ref = eventRef(orgId, boxId);
  await ref.set({
    type,
    triggerType,
    actorType,
    actorId,
    result,
    errorCode,
    payload,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

// 1) Device heartbeat en status update
router.post("/status", async (req, res) => {
  try {
    const { orgId, boxId } = req.params;
    const { shutterState, lightState } = req.body || {};

    const patch = {
      lastSeenAt: FieldValue.serverTimestamp()
    };

    if (shutterState) patch.shutterState = shutterState;
    if (typeof lightState === "boolean") patch.lightState = lightState;

    if (shutterState === "OPEN") {
      patch.lastOpenedAt = FieldValue.serverTimestamp();
    }

    await boxRef(orgId, boxId).set(patch, { merge: true });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "status_failed" });
  }
});

// 2) Device logt events (optioneel, maar handig)
router.post("/events", async (req, res) => {
  try {
    const { orgId, boxId } = req.params;
    const { type, payload, result, errorCode, triggerType, actorType, actorId } = req.body || {};

    if (!type) {
      return res.status(400).json({ ok: false, error: "missing_type" });
    }

    const id = await addEvent({
      orgId,
      boxId,
      type,
      payload: payload || {},
      result: result || "ok",
      errorCode: errorCode || null,
      triggerType: triggerType || "device",
      actorType: actorType || "device",
      actorId: actorId || "simulator"
    });

    res.json({ ok: true, eventId: id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "event_failed" });
  }
});

// 3) Portal of SMS maakt command aan (open of close)
router.post("/commands", async (req, res) => {
  try {
    const { orgId, boxId } = req.params;
    const { type, requestedByType = "portal", requestedById = "unknown" } = req.body || {};

    if (!type || (type !== "open" && type !== "close")) {
      return res.status(400).json({ ok: false, error: "type_must_be_open_or_close" });
    }

    const cmdRef = commandCollection(orgId, boxId).doc();
    await cmdRef.set({
      type,
      status: "queued",
      requestedByType,
      requestedById,
      requestedAt: FieldValue.serverTimestamp()
    });

    await addEvent({
      orgId,
      boxId,
      type: type === "open" ? "command.open.requested" : "command.close.requested",
      triggerType: requestedByType,
      actorType: requestedByType === "sms" ? "phone" : "user",
      actorId: requestedById,
      payload: { commandId: cmdRef.id }
    });

    res.json({ ok: true, commandId: cmdRef.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "command_create_failed" });
  }
});

// 4) Device haalt volgende command op (default polling 5s)
// Neemt de oudste queued command en zet naar delivered in een transaction
router.get("/commands/next", async (req, res) => {
  try {
    const { orgId, boxId } = req.params;

    const result = await db.runTransaction(async (tx) => {
      const q = commandCollection(orgId, boxId)
        .where("status", "==", "queued")
        .orderBy("requestedAt", "asc")
        .limit(1);

      const snap = await tx.get(q);
      if (snap.empty) return null;

      const doc = snap.docs[0];
      tx.update(doc.ref, {
        status: "delivered",
        deliveredAt: FieldValue.serverTimestamp()
      });

      return { id: doc.id, ...doc.data() };
    });

    if (!result) return res.status(204).send();

    await addEvent({
      orgId,
      boxId,
      type: result.type === "open" ? "command.open.sent" : "command.close.sent",
      triggerType: "device",
      actorType: "device",
      actorId: "simulator",
      payload: { commandId: result.id }
    });

    res.json({ ok: true, command: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "command_next_failed" });
  }
});

// 5) Device meldt resultaat terug (executed of failed)
router.post("/commands/:commandId/result", async (req, res) => {
  try {
    const { orgId, boxId, commandId } = req.params;
    const { ok, errorCode, errorMessage } = req.body || {};

    const ref = commandCollection(orgId, boxId).doc(commandId);

    await ref.set(
      {
        status: ok ? "executed" : "failed",
        executedAt: FieldValue.serverTimestamp(),
        errorCode: ok ? null : (errorCode || "unknown"),
        errorMessage: ok ? null : (errorMessage || "failed")
      },
      { merge: true }
    );

    if (!ok) {
      await addEvent({
        orgId,
        boxId,
        type: "error.command.failed",
        triggerType: "device",
        actorType: "device",
        actorId: "simulator",
        result: "error",
        errorCode: errorCode || "unknown",
        payload: { commandId, errorMessage: errorMessage || "failed" }
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "command_result_failed" });
  }
});

export default router;
