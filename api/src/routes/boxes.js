// api/src/routes/boxes.js

import { Router } from "express";
import { db } from "../firebase.js";
import { toBoxDto } from "../dto/boxDto.js";

const router = Router();

// Collecties
const COL_BOXES = "boxes";          // legacy of bestaande boxes
const COL_COMMANDS = "commands";    // nieuw: jouw doc met Portal + status
const COL_BOXCOMMANDS = "boxCommands"; // legacy: losse command doc

/*
=====================================================
HELPERS
=====================================================
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
    status: dto?.lifecycle?.state ?? dto?.status ?? null,
    online: dto?.online ?? computeOnlineFromLastSeen(dto?.lastSeenMinutes),
    agentVersion: dto?.agentVersion ?? pickLegacyAgentVersion(dto),
    hardwareProfile: dto?.hardwareProfile ?? pickLegacyHardwareProfile(dto),
    sharesCount: dto?.sharesCount ?? null
  };
}

async function getBoxDocAny(id) {
  // 1) eerst boxes/<id>
  const boxRef = db.collection(COL_BOXES).doc(id);
  const boxSnap = await boxRef.get();
  if (boxSnap.exists) return { id: boxSnap.id, data: boxSnap.data(), source: COL_BOXES };

  // 2) fallback commands/<id>
  const cmdRef = db.collection(COL_COMMANDS).doc(id);
  const cmdSnap = await cmdRef.get();
  if (cmdSnap.exists) return { id: cmdSnap.id, data: cmdSnap.data(), source: COL_COMMANDS };

  return null;
}

async function listBoxesAny(org) {
  // 1) probeer uit boxes collectie
  let query = db.collection(COL_BOXES);
  if (org) query = query.where("organisationId", "==", org);

  const snap = await query.get();
  if (!snap.empty) {
    return snap.docs.map(d => withLegacyFields(toBoxDto(d.id, d.data())));
  }

  // 2) fallback: commands collectie
  // org filter kan hier alleen werken als organisationId ook in commands docs staat
  let query2 = db.collection(COL_COMMANDS);
  if (org) query2 = query2.where("organisationId", "==", org);

  const snap2 = await query2.get();
  return snap2.docs.map(d => withLegacyFields(toBoxDto(d.id, d.data())));
}

async function setDesiredOnCommandsDoc(boxId, desired) {
  const ref = db.collection(COL_COMMANDS).doc(boxId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const commandId = `cmd-${Date.now()}`;

  // Belangrijk: we updaten enkel status.* en laten Portal en al de rest staan
  await ref.set(
    {
      status: {
        desired,
        commandId,
        requestedAt: new Date(),
        source: "portal-api"
      }
    },
    { merge: true }
  );

  return true;
}

/*
=====================================================
COMMANDS (Firestore-based)
=====================================================
*/

// Legacy endpoint, maar we maken hem slim:
// - eerst boxCommands/<id> (oud)
// - anders commands/<id> (nieuw)
router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;

    const legacy = await db.collection(COL_BOXCOMMANDS).doc(boxId).get();
    if (legacy.exists) return res.json(legacy.data());

    const cmd = await db.collection(COL_COMMANDS).doc(boxId).get();
    if (!cmd.exists) return res.json(null);

    // Geef vooral status terug, maar je kan ook heel doc sturen als je dat wil
    const data = cmd.data() || {};
    res.json(data.status ?? data);
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
      return res.json({ ok: true });
    }

    // Nieuw systeem: we deleten nooit commands/<id> want daar zit ook Portal config in
    // Ack is dan gewoon ok (of je kan hier extra velden zetten als je dat later wilt)
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

/**
 * GET /api/boxes
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

/**
 * GET /api/boxes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const found = await getBoxDocAny(id);
    if (!found) return res.status(404).json({ error: "Box niet gevonden" });

    const dto = withLegacyFields(toBoxDto(found.id, found.data));
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
*/

router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    // Nieuw: als commands/<id> bestaat, zet status.desired = "open"
    const handled = await setDesiredOnCommandsDoc(id, "open");
    if (handled) return res.json({ ok: true, command: "open", boxId: id });

    // Fallback oud: maak command doc in boxCommands
    await db.collection(COL_BOXCOMMANDS).doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "open",
      status: "pending",
      createdAt: new Date()
    });

    res.json({ ok: true, command: "open", boxId: id });
  } catch (err) {
    console.error("Open command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;

    // Nieuw: als commands/<id> bestaat, zet status.desired = "close"
    const handled = await setDesiredOnCommandsDoc(id, "close");
    if (handled) return res.json({ ok: true, command: "close", boxId: id });

    // Fallback oud: maak command doc in boxCommands
    await db.collection(COL_BOXCOMMANDS).doc(id).set({
      commandId: `cmd-${Date.now()}`,
      type: "close",
      status: "pending",
      createdAt: new Date()
    });

    res.json({ ok: true, command: "close", boxId: id });
  } catch (err) {
    console.error("Close command error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

export default router;
