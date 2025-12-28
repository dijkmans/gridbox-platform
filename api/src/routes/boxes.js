import { Router } from "express";
import { Storage } from "@google-cloud/storage";
import { db } from "../firebase.js";
import { toBoxDto } from "../dto/boxDto.js";

const router = Router();

/*
=====================================================
COMMANDS (Firestore-based, legacy)
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
    const { boxId } = req.params;
    await db.collection("boxCommands").doc(boxId).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("Command ack error:", err);
    res.status(500).json({ ok: false });
  }
});

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
  if (dto?.Agent == null) return null;
  if (typeof dto.Agent === "string") return dto.Agent;
  if (typeof dto.Agent === "object") return dto.Agent.version ?? dto.Agent.name ?? null;
  return String(dto.Agent);
}

function pickLegacyHardwareProfile(dto) {
  if (dto?.Profile == null) return dto?.box?.type ?? null;
  if (typeof dto.Profile === "string") return dto.Profile;
  if (typeof dto.Profile === "object") return dto.Profile.name ?? dto.Profile.code ?? null;
  return String(dto.Profile);
}

function withLegacyFields(dto) {
  return {
    ...dto,

    // legacy frontend velden
    customer: dto?.Portal?.Customer ?? dto?.organisation?.name ?? null,
    site: dto?.Portal?.Site ?? null,
    boxNumber: dto?.Portal?.BoxNumber ?? null,

    // ENIGE statusbron (legacy)
    status: dto?.status?.state ?? null,

    online: dto?.online ?? computeOnlineFromLastSeen(dto?.lastSeenMinutes),
    agentVersion: dto?.agentVersion ?? pickLegacyAgentVersion(dto),
    hardwareProfile: dto?.hardwareProfile ?? pickLegacyHardwareProfile(dto),
    sharesCount: dto?.sharesCount ?? null
  };
}

function requireCaptureBucket() {
  const name = process.env.CAPTURE_BUCKET;
  if (!name) throw new Error("CAPTURE_BUCKET ontbreekt (env var).");
  return name;
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/*
=====================================================
BOX ROUTES (Frontend / Portal)
=====================================================
*/

/**
 * GET /api/boxes
 */
router.get("/", async (req, res) => {
  try {
    const org = (req.query.org || "").toString().trim();

    let query = db.collection("boxes");
    if (org) query = query.where("organisationId", "==", org);

    const snap = await query.get();

    const boxes = snap.docs.map(d => {
      const data = d.data();
      const dto = toBoxDto(d.id, data);

      // desired expliciet in box zetten
      dto.box = {
        ...dto.box,
        desired: data.box?.desired ?? null,
        desiredAt: data.box?.desiredAt ?? null,
        desiredBy: data.box?.desiredBy ?? null
      };

      return withLegacyFields(dto);
    });

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

    if (!doc.exists) {
      return res.status(404).json({ error: "Box niet gevonden" });
    }

    const data = doc.data();
    const dto = toBoxDto(doc.id, data);

    // desired expliciet in box zetten
    dto.box = {
      ...dto.box,
      desired: data.box?.desired ?? null,
      desiredAt: data.box?.desiredAt ?? null,
      desiredBy: data.box?.desiredBy ?? null
    };

    res.json(withLegacyFields(dto));
  } catch (err) {
    console.error("GET /api/boxes/:id error:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});

/*
=====================================================
PICTURES VIEWER (Portal)
=====================================================
*/

/**
 * GET /api/boxes/:id/pictures
 * Doel: de portal knop "PICTURES" laten werken zonder dat je de portal moet aanpassen.
 *
 * Verwacht bestanden in GCS:
 * boxes/<boxId>/sessions/<sessionId>/raw/*.jpg
 *
 * Vereist env var:
 * CAPTURE_BUCKET
 */
router.get("/:id/pictures", async (req, res) => {
  try {
    const boxId = req.params.id;

    const bucketName = requireCaptureBucket();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    // Sessions zoeken in GCS (prefixes)
    const sessionsPrefix = `boxes/${boxId}/sessions/`;
    const [_files, _nextQuery, apiResp] = await bucket.getFiles({
      prefix: sessionsPrefix,
      delimiter: "/",
      maxResults: 200,
      autoPaginate: false
    });

    const prefixes = apiResp?.prefixes || [];
    const sessions = prefixes
      .map(p => p.slice(sessionsPrefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a)); // newest eerst

    if (!sessions.length) {
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res
        .status(404)
        .send(`<h1>Geen sessions gevonden</h1><p>Box: ${esc(boxId)}</p>`);
    }

    const requested = (req.query.sessionId || "").toString().trim();
    const sessionId = requested && sessions.includes(requested) ? requested : sessions[0];

    // Foto's zoeken in gekozen session
    const rawPrefix = `boxes/${boxId}/sessions/${sessionId}/raw/`;
    const [files] = await bucket.getFiles({
      prefix: rawPrefix,
      maxResults: 500,
      autoPaginate: false
    });

    const jpgs = (files || [])
      .filter(f => f.name.endsWith(".jpg"))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (!jpgs.length) {
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res
        .status(404)
        .send(`<h1>Geen foto's gevonden</h1><p>Box: ${esc(boxId)}<br>Session: ${esc(sessionId)}</p>`);
    }

    // Signed URLs maken (10 min geldig)
    const expires = Date.now() + 10 * 60 * 1000;
    const items = await Promise.all(
      jpgs.map(async f => {
        const name = f.name.split("/").pop();
        const [url] = await f.getSignedUrl({ action: "read", expires });
        return { name, url };
      })
    );

    const options = sessions
      .map(s => `<option value="${esc(s)}"${s === sessionId ? " selected" : ""}>${esc(s)}</option>`)
      .join("");

    const thumbs = items
      .map(i => {
        return `
          <a href="${i.url}" target="_blank" rel="noopener">
            <img src="${i.url}" alt="${esc(i.name)}" loading="lazy">
          </a>
        `;
      })
      .join("");

    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pictures ${esc(boxId)}</title>
  <style>
    body{font-family:system-ui,Arial;margin:16px}
    header{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
    img{width:100%;height:140px;object-fit:cover;border-radius:10px;background:#eee}
    select,button{padding:8px 10px;font-size:14px}
    .muted{opacity:.7}
  </style>
</head>
<body>
  <header>
    <h2 style="margin:0">Pictures</h2>
    <div class="muted">Box: ${esc(boxId)}</div>
    <label>
      Session
      <select id="sess">${options}</select>
    </label>
    <button id="go">Open</button>
  </header>

  <div class="grid">${thumbs}</div>

  <script>
    const sel = document.getElementById("sess");
    document.getElementById("go").onclick = () => {
      const s = encodeURIComponent(sel.value);
      location.href = location.pathname + "?sessionId=" + s;
    };
  </script>
</body>
</html>`);
  } catch (e) {
    console.error("pictures viewer error", e);
    return res.status(500).send(String(e?.message || e));
  }
});

/*
=====================================================
DESIRED (nieuwe, correcte route)
=====================================================
*/

/**
 * POST /api/boxes/:id/desired
 * UI / Portal zet intentie
 */
router.post("/:id/desired", async (req, res) => {
  try {
    const { id } = req.params;
    const { desired, desiredBy } = req.body;

    if (!["open", "close"].includes(desired)) {
      return res.status(400).json({
        ok: false,
        message: "Ongeldige desired waarde"
      });
    }

    await db.collection("boxes").doc(id).update({
      "box.desired": desired,
      "box.desiredAt": new Date(),
      "box.desiredBy": desiredBy || "portal"
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Set desired error:", err);
    res.status(500).json({
      ok: false,
      message: "Interne serverfout"
    });
  }
});

/*
=====================================================
ACTIONS (open / close, legacy, blijven werken)
=====================================================
*/

router.post("/:id/open", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("boxCommands").doc(id).set({
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

    await db.collection("boxCommands").doc(id).set({
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
