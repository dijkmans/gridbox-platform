// api/src/routes/boxes.js

import { Router } from "express";
import admin from "firebase-admin";
import { db } from "../firebase.js";
import { toBoxDto } from "../dto/boxDto.js";

const router = Router();

/*
=====================================================
COMMANDS (Firestore-based)
=====================================================
*/

router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;
    const snap = await db.collection("boxCommands").doc(boxId).get();
    if (!snap.exists) return res.json(null);
    res.json(snap.data());
  } catch (err) {
    console.error("Command fetch error:", err);
    res.status(500).json(null);
  }
});

router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId, commandId } = req.params;

    const ts = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    // legacy: delete single command doc
    batch.delete(db.collection("boxCommands").doc(boxId));

    // new queue (optional): mark ack on boxes/{boxId}/commands/{commandId}
    // (als die doc niet bestaat, wordt hij aangemaakt met merge:true)
    batch.set(
      db.collection("boxes").doc(boxId).collection("commands").doc(commandId),
      { acked: true, ackedAt: ts },
      { merge: true }
    );

    await batch.commit();

    res.json({ ok: true });
  } catch (err) {
    console.error("Command ack error:", err);
    res.status(500).json({ ok: false });
  }
});

/*
=====================================================
BOX ROUTES (Frontend / Portal)
=====================================================
Firestore is de bron van waarheid.
We sturen BoxDto terug + legacy velden zodat oudere code niet breekt.
*/

function computeOnlineFromLastSeen(lastSeenMinutes) {
  const n = Number(lastSeenMinutes);
  if (Number.isNaN(n)) return null;
  return n <= 2;
}

function pickLegacyAgentVersion(dto) {
  if (dto?.Agent === null || dto?.Agent === undefined) return null;
  if (typeof dto.Agent === "string") return dto.Agent;
  if (typeof dto.Agent === "object") return dto.Agent.version ?? dto.Agent.name ?? null;
  return String(dto.Agent);
}

function pickLegacyHardwareProfile(dto) {
  if (dto?.Profile === null || dto?.Profile === undefined) return dto?.box?.type ?? null;
  if (typeof dto.Profile === "string") return dto.Profile;
  if (typeof dto.Profile === "object") return dto.Profile.name ?? dto.Profile.code ?? null;
  return String(dto.Profile);
}

function withLegacyFields(dto) {
  return {
    ...dto,
    customer: dto?.Portal?.Customer ?? dto?.organisation?.name ?? null,
    site: dto?.Portal?.Site ?? null,
    boxNumber: dto?.Portal?.BoxNumber ?? null,

    // legacy veldnaam "status" bleef vroeger lifecycle.state
    status: dto?.lifecycle?.state ?? null,

    online: dto?.online ?? computeOnlineFromLastSeen(dto?.lastSeenMinutes),
    agentVersion: dto?.agentVersion ?? pickLegacyAgentVersion(dto),
    hardwareProfile: dto?.hardwareProfile ?? pickLegacyHardwareProfile(dto),
    sharesCount: dto?.sharesCount ?? null
  };
}

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
    const org = (req.query.org || "").toString().trim();

    let query = db.collection("boxes");
    if (org) query = query.where("organisationId", "==", org);

    const snap = await query.get();

    const boxes = snap.docs.map(d => withLegacyFields(toBoxDto(d.id, d.data())));
    res.json(boxes);
  } catch (err) {
    console.error("GET /api/boxes error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const doc = await db.collection("boxes").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Box niet gevonden" });

    const dto = withLegacyFields(toBoxDto(doc.id, doc.data()));
    res.json(dto);
  } catch (err) {
    console.error("GET /api/boxes/:id error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/*
=====================================================
ACTIONS (open / close)
=====================================================
Doel:
- Bij klik in portal: Firestore moet meteen intent vastleggen:
  - status.desired = "open" of "closed"
  - state.state = "opening" of "closing"
- Command blijft ook bestaan voor agent compatibiliteit:
  - boxCommands/{id} (legacy)
  - boxes/{id}/commands/{commandId} (queue)
*/

function pickRequestedBy(req) {
  // probeer een paar plaatsen, zonder te breken als het er niet is
  const b = req.body || {};
  const q = req.query || {};
  return (
    (typeof b.requestedBy === "string" && b.requestedBy.trim()) ||
    (typeof b.phone === "string" && b.phone.trim()) ||
    (typeof q.requestedBy === "string" && q.requestedBy.trim()) ||
    (typeof req.headers["x-requested-by"] === "string" && String(req.headers["x-requested-by"]).trim()) ||
    null
  );
}

async function setDesiredAndCommand({ id, desired, phase, type, req }) {
  const boxRef = db.collection("boxes").doc(id);
  const boxSnap = await boxRef.get();
  if (!boxSnap.exists) return { ok: false, status: 404, error: "Box niet gevonden" };

  const requestedBy = pickRequestedBy(req);
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const commandId = `cmd-${Date.now()}`;

  const legacyCommandRef = db.collection("boxCommands").doc(id);
  const queueCommandRef = boxRef.collection("commands").doc(commandId);

  const batch = db.batch();

  // 1) intent + state in boxes/{id}
  const updatePayload = {
    "status.desired": desired,
    "status.desiredAt": ts,

    "state.state": phase,
    "state.since": ts,
    "state.requestedAt": ts,
    "state.source": "portal"
  };

  if (requestedBy) {
    updatePayload["state.requestedBy"] = requestedBy;
  }

  batch.update(boxRef, updatePayload);

  // 2) legacy command doc (agent compat)
  batch.set(legacyCommandRef, {
    commandId,
    type,
    status: "pending",
    source: "portal",
    requestedBy: requestedBy || null,
    createdAt: ts
  });

  // 3) new queue command doc (handig voor later)
  batch.set(queueCommandRef, {
    commandId,
    type,
    status: "pending",
    source: "portal",
    requestedBy: requestedBy || null,
    createdAt: ts
  });

  await batch.commit();

  return { ok: true, commandId };
}

router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    const r = await setDesiredAndCommand({
      id,
      desired: "open",
      phase: "opening",
      type: "open",
      req
    });

    if (!r.ok) return res.status(r.status).json({ error: r.error });

    res.json({ ok: true, command: "open", boxId: id, commandId: r.commandId, desired: "open" });
  } catch (err) {
    console.error("Open command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    const r = await setDesiredAndCommand({
      id,
      desired: "closed",
      phase: "closing",
      type: "close",
      req
    });

    if (!r.ok) return res.status(r.status).json({ error: r.error });

    res.json({ ok: true, command: "close", boxId: id, commandId: r.commandId, desired: "closed" });
  } catch (err) {
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
