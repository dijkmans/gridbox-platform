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
      .sort((a, b) => b.name.localeCompare(a.name)); // nieuwste eerst

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
        const ts = (f.metadata?.metadata?.ts || f.metadata?.timeCreated || f.metadata?.updated || null);
        return { name, url, ts };
      })
    );

    const options = sessions
      .map(s => `<option value="${esc(s)}"${s === sessionId ? " selected" : ""}>${esc(s)}</option>`)
      .join("");

    const thumbs = items
      .map(i => `
        <div class="thumbwrap">
          <a href="${i.url}" class="thumb" data-name="${esc(i.name)}" data-ts="${esc(i.ts || "")}" rel="noopener">
            <img src="${i.url}" alt="${esc(i.name)}" loading="lazy">
          </a>
          <div class="thumb-meta" data-ts="${esc(i.ts || "")}"></div>
        </div>
      `)
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
    .grid img{width:100%;height:140px;object-fit:cover;border-radius:10px;background:#eee}
    .thumbwrap{display:flex;flex-direction:column;gap:6px}
    .thumb-meta{font-size:12px;opacity:.75}
    select,button{padding:8px 10px;font-size:14px}
    .muted{opacity:.7}

    .thumb{display:block}
    .lb.hidden{display:none}
    .lb{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center}
    .lb-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.75)}
    .lb-panel{position:relative;max-width:min(1200px,95vw);max-height:92vh;z-index:1}
    .lb-img{max-width:95vw;max-height:82vh;display:block;border-radius:12px;background:#111}
    .lb-caption{color:#fff;opacity:.85;margin-top:8px;font-size:14px}
    .lb-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.55);color:#fff;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-size:18px}
    .lb-prev{left:-52px}
    .lb-next{right:-52px}
    .lb-close{top:-46px;right:0;transform:none}
    @media (max-width:700px){
      .lb-prev{left:6px}
      .lb-next{right:6px}
      .lb-close{top:6px;right:6px}
    }
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
    <button id="take">TAKE PICTURE</button>
    <span id="takeStatus" class="muted"></span>
  </header>

  <div class="grid">${thumbs}</div>

  <div id="lb" class="lb hidden">
    <div id="lbBack" class="lb-backdrop"></div>
    <div class="lb-panel">
      <button id="lbClose" class="lb-btn lb-close" aria-label="Close">✕</button>
      <button id="lbPrev" class="lb-btn lb-prev" aria-label="Previous">‹</button>
      <img id="lbImg" class="lb-img" alt="">
      <button id="lbNext" class="lb-btn lb-next" aria-label="Next">›</button>
      <div id="lbCaption" class="lb-caption"></div>
    </div>
  </div>

  <script>
    const sel = document.getElementById("sess");
    document.getElementById("go").onclick = () => {
      const s = encodeURIComponent(sel.value);
      location.href = location.pathname + "?sessionId=" + s;
    };

    function fmtTs(ts) {
      if (!ts) return "";
      const t = Date.parse(ts);
      if (!Number.isFinite(t)) return "";
      return new Intl.DateTimeFormat("nl-BE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(t));
    }

    // timestamps onder thumbnails
    document.querySelectorAll(".thumb-meta").forEach(el => {
      const ts = el.getAttribute("data-ts") || "";
      el.textContent = fmtTs(ts);
    });

    // TAKE PICTURE (manual snapshot)
    const takeBtn = document.getElementById("take");
    const takeStatus = document.getElementById("takeStatus");
    const boxId = "${esc(boxId)}";

    async function waitForPicture(sessionId, timeoutMs = 20000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try {
          const url =
            "/api/boxes/" + encodeURIComponent(boxId) +
            "/capture/sessions/" + encodeURIComponent(sessionId) +
            "/pictures?limit=1";
          const r = await fetch(url, { cache: "no-store" });
          if (r.ok) {
            const j = await r.json().catch(() => null);
            if (j && j.ok && Array.isArray(j.items) && j.items.length) return true;
          }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
      }
      return false;
    }

    takeBtn?.addEventListener("click", async () => {
      takeBtn.disabled = true;
      try {
        takeStatus.textContent = "Foto nemen...";
        const startUrl = "/api/boxes/" + encodeURIComponent(boxId) + "/capture/start";
        const r = await fetch(startUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intervalMs: 500, postCloseMs: 0 })
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok || !j?.sessionId) {
          throw new Error(j?.error || "Start capture mislukt");
        }
        takeStatus.textContent = "Wachten op foto...";
        const ok = await waitForPicture(j.sessionId, 20000);
        if (!ok) {
          throw new Error("Geen foto binnen 20 seconden");
        }
        location.href = location.pathname + "?sessionId=" + encodeURIComponent(j.sessionId);
      } catch (e) {
        alert("Kon geen foto nemen: " + (e?.message || e));
      } finally {
        takeBtn.disabled = false;
        takeStatus.textContent = "";
      }
    });


    const lb = document.getElementById("lb");
    const lbImg = document.getElementById("lbImg");
    const lbCaption = document.getElementById("lbCaption");
    const lbBack = document.getElementById("lbBack");
    const lbClose = document.getElementById("lbClose");
    const lbPrev = document.getElementById("lbPrev");
    const lbNext = document.getElementById("lbNext");

    const thumbsEls = Array.from(document.querySelectorAll("a.thumb"));
    let idx = -1;

    function show(i) {
      if (!thumbsEls.length) return;
      idx = (i + thumbsEls.length) % thumbsEls.length;
      const a = thumbsEls[idx];
      lbImg.src = a.href;
      const name = a.dataset.name || "";
      const ts = a.dataset.ts || "";
      const fts = fmtTs(ts);
      lbCaption.textContent = fts ? (name + "  " + fts) : name;
      lb.classList.remove("hidden");
    }

    function hide() {
      lb.classList.add("hidden");
      lbImg.src = "";
      idx = -1;
    }

    thumbsEls.forEach((a, i) => {
      a.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        show(i);
      });
    });

    lbBack.addEventListener("click", hide);
    lbClose.addEventListener("click", hide);
    lbPrev.addEventListener("click", () => show(idx - 1));
    lbNext.addEventListener("click", () => show(idx + 1));

    document.addEventListener("keydown", (e) => {
      if (lb.classList.contains("hidden")) return;
      if (e.key === "Escape") hide();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
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
