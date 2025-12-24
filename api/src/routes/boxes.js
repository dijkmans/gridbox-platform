// api/src/routes/boxes.js

import { Router } from "express";
import { db } from "../firebase.js";
import { toBoxDto } from "../dto/boxDto.js";

const router = Router();

const COL_BOXES = "boxes";
const COL_COMMANDS = "commands";
const COL_BOXCOMMANDS = "boxCommands";

function computeOnlineFromLastSeen(lastSeenMinutes) {
  const n = Number(lastSeenMinutes);
  if (Number.isNaN(n)) return null;
  return n <= 2;
}

function withLegacyFields(dto) {
  return {
    ...dto,
    customer: dto?.Portal?.Customer ?? dto?.organisation?.name ?? null,
    site: dto?.Portal?.Site ?? null,
    boxNumber: dto?.Portal?.BoxNumber ?? null,
    online: dto?.online ?? computeOnlineFromLastSeen(dto?.lastSeenMinutes)
  };
}

async function getBoxDocAny(id) {
  const cmdSnap = await db.collection(COL_COMMANDS).doc(id).get();
  if (cmdSnap.exists) return { id: cmdSnap.id, data: cmdSnap.data(), source: COL_COMMANDS };

  const boxSnap = await db.collection(COL_BOXES).doc(id).get();
  if (boxSnap.exists) return { id: boxSnap.id, data: boxSnap.data(), source: COL_BOXES };

  return null;
}

async function listBoxesAny(org) {
  let q1 = db.collection(COL_COMMANDS);
  if (org) q1 = q1.where("organisationId", "==", org);
  const s1 = await q1.get();
  if (!s1.empty) return s1.docs.map(d => withLegacyFields(toBoxDto(d.id, d.data())));

  let q2 = db.collection(COL_BOXES);
  if (org) q2 = q2.where("organisationId", "==", org);
  const s2 = await q2.get();
  return s2.docs.map(d => withLegacyFields(toBoxDto(d.id, d.data())));
}

async function ensureCommandsDoc(boxId) {
  const cmdRef = db.collection(COL_COMMANDS).doc(boxId);
  const cmdSnap = await cmdRef.get();
  if (cmdSnap.exists) return { ref: cmdRef, created: false };

  // clone van boxes/<id> als die bestaat
  const boxSnap = await db.collection(COL_BOXES).doc(boxId).get();
  if (boxSnap.exists) {
    await cmdRef.set(
      { ...boxSnap.data(), migratedFrom: "boxes", migratedAt: new Date() },
      { merge: true }
    );
  } else {
    await cmdRef.set({ migratedFrom: "created", migratedAt: new Date() }, { merge: true });
  }

  return { ref: cmdRef, created: true };
}

async function writeLegacyBoxCommand(boxId, desired) {
  const commandId = `cmd-${Date.now()}`;
  await db.collection(COL_BOXCOMMANDS).doc(boxId).set({
    commandId,
    type: desired,
    status: "pending",
    createdAt: new Date()
  });
  return commandId;
}

async function setDesiredDualWrite(boxId, desired) {
  const { ref, created } = await ensureCommandsDoc(boxId);

  const commandId = `cmd-${Date.now()}`;

  // nieuw
  await ref.set(
    { status: { desired, commandId, requestedAt: new Date(), source: "portal-api" } },
    { merge: true }
  );

  // legacy (blijven zetten voor compatibiliteit)
  await writeLegacyBoxCommand(boxId, desired);

  return { ok: true, commandId, createdCommandsDoc: created };
}

/*
=====================================================
ROUTES
=====================================================
*/

router.get("/", async (req, res) => {
  try {
    const org = (req.query.org || "").toString().trim();
    const boxes = await listBoxesAny(org);
    res.json(boxes);
  } catch (err) {
    console.error("GET /api/boxes error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const found = await getBoxDocAny(id);
    if (!found) return res.status(404).json({ error: "Box niet gevonden" });

    res.json(withLegacyFields(toBoxDto(found.id, found.data)));
  } catch (err) {
    console.error("GET /api/boxes/:id error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

// status endpoint: eerst commands (nieuw), anders boxCommands (oud)
router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;

    const cmd = await db.collection(COL_COMMANDS).doc(boxId).get();
    if (cmd.exists) {
      const data = cmd.data() || {};
      return res.json(data.status ?? data);
    }

    const legacy = await db.collection(COL_BOXCOMMANDS).doc(boxId).get();
    if (legacy.exists) return res.json(legacy.data());

    return res.json(null);
  } catch (err) {
    console.error("Command fetch error:", err);
    res.status(500).json(null);
  }
});

router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;

    const legacyRef = db.collection(COL_BOXCOMMANDS).doc(boxId);
    const legacy = await legacyRef.get();
    if (legacy.exists) {
      await legacyRef.delete();
    }

    // commands/<id> deleten we niet
    res.json({ ok: true });
  } catch (err) {
    console.error("Command ack error:", err);
    res.status(500).json({ ok: false });
  }
});

router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await setDesiredDualWrite(id, "open");
    res.json({ ok: true, command: "open", boxId: id, writtenTo: "commands+boxCommands", ...r, path: `commands/${id}` });
  } catch (err) {
    console.error("Open command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await setDesiredDualWrite(id, "close");
    res.json({ ok: true, command: "close", boxId: id, writtenTo: "commands+boxCommands", ...r, path: `commands/${id}` });
  } catch (err) {
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;