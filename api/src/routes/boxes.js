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
  const name =
    process.env.CAPTURE_BUCKET ||
    process.env.GCS_BUCKET ||
    process.env.BUCKET_NAME;

  if (!name) {
    throw new Error(
      "Capture bucket ontbreekt. Zet CAPTURE_BUCKET (aanbevolen) of gebruik GCS_BUCKET/BUCKET_NAME voor compat."
    );
  }
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
 * GET /api/boxes/:id/pictures/file?object=...
 * Proxy voor GCS images (zelfde origin) zodat canvas-getImageData werkt.
 *
 * Veiligheid:
 * - object moet beginnen met: boxes/<boxId>/sessions/
 * - en eindigen op .jpg
 */
router.get("/:id/pictures/file", async (req, res) => {
  try {
    const boxId = req.params.id;
    const object = (req.query.object || "").toString();

    const mustStart = `boxes/${boxId}/sessions/`;
    if (!object || !object.startsWith(mustStart) || !object.endsWith(".jpg")) {
      return res.status(400).send("Ongeldig object");
    }

    const storage = new Storage();
    const bucketName = requireCaptureBucket();
    const bucket = storage.bucket(bucketName);

    res.setHeader("content-type", "image/jpeg");
    res.setHeader("cache-control", "private, max-age=600");

    const file = bucket.file(object);
    file
      .createReadStream()
      .on("error", (e) => {
        console.error("pictures/file stream error", e);
        if (!res.headersSent) res.status(404);
        res.end();
      })
      .pipe(res);
  } catch (e) {
    console.error("pictures/file error", e);
    return res.status(500).send(String(e?.message || e));
  }
});

/**
 * GET /api/boxes/:id/pictures
 * Doel: de portal knop "PICTURES" laten werken zonder dat je de portal moet aanpassen.
 *
 * Verwacht bestanden in GCS:
 * boxes/<boxId>/sessions/<sessionId>/raw/*.jpg
 *
 * Vereist env var:
 * CAPTURE_BUCKET (aanbevolen) of GCS_BUCKET/BUCKET_NAME
 *
 * Extra:
 * - Dubbels detecteren in de browser via canvas downsampling + kleur-quantisatie.
 * - Hiermee worden bijna-identieke foto's (bv compressie) toch gegroepeerd.
 */
router.get("/:id/pictures", async (req, res) => {
  try {
    const boxId = req.params.id;

    const storage = new Storage();
    const bucketName = requireCaptureBucket();
    const bucket = storage.bucket(bucketName);

    const sessionsPrefix = `boxes/${boxId}/sessions/`;

    // sessies ophalen via "delimiter" zodat we enkel de mappen krijgen
    const [, , apiResp] = await bucket.getFiles({
      prefix: sessionsPrefix,
      delimiter: "/",
      autoPaginate: false,
      maxResults: 500
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

    const items = jpgs.map(f => {
      const object = f.name;
      const name = f.name.split("/").pop();
      const ts = f.metadata?.metadata?.ts || f.metadata?.timeCreated || f.metadata?.updated || null;

      // same-origin proxy url
      const url = `/api/boxes/${encodeURIComponent(boxId)}/pictures/file?object=${encodeURIComponent(object)}`;
      return { name, url, ts, object };
    });

    const options = sessions
      .map(s => `<option value="${esc(s)}"${s === sessionId ? " selected" : ""}>${esc(s)}</option>`)
      .join("");

    const thumbs = items
      .map(i => `
        <div class="thumbwrap">
          <a href="${i.url}" class="thumb" data-name="${esc(i.name)}" data-ts="${esc(i.ts || "")}" data-object="${esc(i.object)}" rel="noopener">
            <span class="dup-badge" hidden></span>
            <img src="${i.url}" alt="${esc(i.name)}" loading="lazy" decoding="async">
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

    .thumb{display:block;position:relative}
    .dup-badge{
      position:absolute;
      top:8px;
      left:8px;
      background:rgba(0,0,0,.55);
      color:#fff;
      font-size:12px;
      padding:4px 8px;
      border-radius:999px;
      z-index:2;
      user-select:none;
    }
    .thumbwrap.is-dup-hidden{display:none}

    details{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fafafa}
    details summary{cursor:pointer;font-weight:600}
    #dupOut{white-space:pre-wrap;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;max-height:240px;overflow:auto;margin-top:10px}

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
    <button id="go" type="button">Open</button>

    <label>
      Tolerantie
      <select id="tol">
        <option value="strict">Streng (32x32)</option>
        <option value="normal" selected>Normaal (16x16)</option>
        <option value="loose">Los (8x8)</option>
      </select>
    </label>

    <button id="scan" type="button">Zoek dubbels</button>

    <label style="display:flex;gap:6px;align-items:center">
      <input type="checkbox" id="hideDup" checked>
      Verberg dubbels
    </label>

    <button id="reset" type="button">Reset</button>

    <span id="scanStatus" class="muted"></span>
  </header>

  <details id="dupDetails" class="muted" style="margin:8px 0 14px">
    <summary>Overzicht dubbels</summary>
    <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button id="copyDup" type="button">Kopieer lijst</button>
      <div id="dupCounts"></div>
    </div>
    <pre id="dupOut"></pre>
  </details>

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

    // =========================================================
    // DUBBELS (Perceptual-ish hashing via canvas)
    // =========================================================

    const tolSel = document.getElementById("tol");
    const scanBtn = document.getElementById("scan");
    const resetBtn = document.getElementById("reset");
    const hideDup = document.getElementById("hideDup");
    const scanStatus = document.getElementById("scanStatus");

    const dupDetails = document.getElementById("dupDetails");
    const dupOut = document.getElementById("dupOut");
    const dupCounts = document.getElementById("dupCounts");
    const copyDup = document.getElementById("copyDup");

    const allThumbsEls = Array.from(document.querySelectorAll("a.thumb"));

    let lastGroups = null; // Map hash -> index[]

    function tolConfig(){
      const v = tolSel.value;
      if (v === "strict") return { size: 32, step: 32 };
      if (v === "loose") return { size: 8, step: 128 };
      return { size: 16, step: 64 };
    }

    async function loadImage(src){
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      if (img.decode) {
        await img.decode();
      } else {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("load fail"));
        });
      }
      return img;
    }

    function visualHash(img, size, step){
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let out = "";
      for (let i = 0; i < data.length; i += 4){
        const r = Math.floor((data[i] || 0) / step);
        const g = Math.floor((data[i + 1] || 0) / step);
        const b = Math.floor((data[i + 2] || 0) / step);
        out += r.toString(16) + g.toString(16) + b.toString(16);
      }
      return out;
    }

    function clearDupMarks(){
      allThumbsEls.forEach(a => {
        const wrap = a.closest(".thumbwrap");
        wrap?.classList.remove("is-dup-hidden");
        a.removeAttribute("data-dup-hash");
        const badge = a.querySelector(".dup-badge");
        if (badge){
          badge.hidden = true;
          badge.textContent = "";
        }
      });
      dupOut.textContent = "";
      dupCounts.textContent = "";
      lastGroups = null;
      scanStatus.textContent = "";
    }

    function applyHideSetting(){
      if (!lastGroups) return;

      // eerst alles terug zichtbaar
      allThumbsEls.forEach(a => a.closest(".thumbwrap")?.classList.remove("is-dup-hidden"));

      if (!hideDup.checked) return;

      lastGroups.forEach((idxs) => {
        if (!idxs || idxs.length < 2) return;
        // keep = eerste in DOM volgorde (pagina is al newest eerst)
        for (let k = 1; k < idxs.length; k++){
          const a = allThumbsEls[idxs[k]];
          a?.closest(".thumbwrap")?.classList.add("is-dup-hidden");
        }
      });
    }

    function buildDupOutput(){
      if (!lastGroups) return;
      const lines = [];
      let groups = 0;
      let dups = 0;

      lastGroups.forEach((idxs, h) => {
        if (!idxs || idxs.length < 2) return;
        groups += 1;
        dups += (idxs.length - 1);

        const keepA = allThumbsEls[idxs[0]];
        const keepObj = keepA?.dataset?.object || "";
        lines.push("# groep " + h);
        lines.push("# keep: " + keepObj);
        for (let k = 1; k < idxs.length; k++){
          const a = allThumbsEls[idxs[k]];
          const obj = a?.dataset?.object || "";
          if (obj) lines.push(obj);
        }
        lines.push("");
      });

      dupCounts.textContent = "Groepen: " + groups + "  Dubbels: " + dups;
      dupOut.textContent = lines.join("\\n");
    }

    async function runPool(tasks, limit){
      let i = 0;
      const workers = Array.from({ length: limit }, async () => {
        while (i < tasks.length){
          const cur = i++;
          await tasks[cur]();
        }
      });
      await Promise.all(workers);
    }

    async function scanDuplicates(){
      clearDupMarks();

      const cfg = tolConfig();
      const total = allThumbsEls.length;
      if (!total){
        scanStatus.textContent = "Geen foto's";
        return;
      }

      scanBtn.disabled = true;
      tolSel.disabled = true;
      scanStatus.textContent = "Scannen: 0/" + total;

      const groups = new Map();
      let done = 0;

      const tasks = allThumbsEls.map((a, index) => async () => {
        try{
          const img = await loadImage(a.href);
          const h = visualHash(img, cfg.size, cfg.step);
          a.setAttribute("data-dup-hash", h);

          if (!groups.has(h)) groups.set(h, []);
          groups.get(h).push(index);
        } catch {
          // negeer fouten
        }

        done += 1;
        if (done % 5 === 0 || done === total){
          scanStatus.textContent = "Scannen: " + done + "/" + total;
          await new Promise(r => setTimeout(r, 0));
        }
      });

      await runPool(tasks, 4);

      // sort indices per hash op DOM volgorde (veiligheid)
      groups.forEach((idxs, h) => {
        idxs.sort((a, b) => a - b);
        groups.set(h, idxs);
      });

      // badges + tellers
      let dupGroups = 0;
      let dupCount = 0;

      groups.forEach((idxs, h) => {
        if (!idxs || idxs.length < 2) return;
        dupGroups += 1;
        dupCount += (idxs.length - 1);

        const keepA = allThumbsEls[idxs[0]];
        const badge = keepA?.querySelector(".dup-badge");
        if (badge){
          badge.hidden = false;
          badge.textContent = "+" + (idxs.length - 1);
        }
      });

      lastGroups = groups;
      applyHideSetting();
      buildDupOutput();
      dupDetails.open = true;

      scanStatus.textContent = dupGroups
        ? ("Klaar. Groepen: " + dupGroups + ", dubbels: " + dupCount)
        : "Klaar. Geen dubbels gevonden";

      scanBtn.disabled = false;
      tolSel.disabled = false;
    }

    scanBtn.addEventListener("click", scanDuplicates);
    resetBtn.addEventListener("click", clearDupMarks);
    hideDup.addEventListener("change", () => {
      applyHideSetting();
    });

    copyDup.addEventListener("click", async () => {
      try{
        await navigator.clipboard.writeText(dupOut.textContent || "");
        scanStatus.textContent = "Lijst gekopieerd";
      } catch {
        scanStatus.textContent = "Kopiëren lukt niet in deze browser";
      }
    });

    // =========================================================
    // Lightbox (werkt ook als dubbels verborgen zijn)
    // =========================================================
    const lb = document.getElementById("lb");
    const lbImg = document.getElementById("lbImg");
    const lbCap = document.getElementById("lbCaption");
    const lbBack = document.getElementById("lbBack");
    const lbClose = document.getElementById("lbClose");
    const lbPrev = document.getElementById("lbPrev");
    const lbNext = document.getElementById("lbNext");

    let idx = -1;

    function getActiveThumbs(){
      if (!hideDup.checked) return allThumbsEls;
      return allThumbsEls.filter(a => !a.closest(".thumbwrap")?.classList.contains("is-dup-hidden"));
    }

    function show(i){
      const list = getActiveThumbs();
      if (!list.length) return;
      idx = (i + list.length) % list.length;
      const a = list[idx];
      lbImg.src = a.href;
      lbCap.textContent = (a.dataset.name || "") + (a.dataset.ts ? ("  " + fmtTs(a.dataset.ts)) : "");
      lb.classList.remove("hidden");
    }

    function hide(){
      lb.classList.add("hidden");
      lbImg.src = "";
      idx = -1;
    }

    allThumbsEls.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const list = getActiveThumbs();
        const i = Math.max(0, list.indexOf(a));
        show(i);
      });
    });

    lbBack.addEventListener("click", hide);
    lbClose.addEventListener("click", hide);
    lbPrev.addEventListener("click", () => show(idx - 1));
    lbNext.addEventListener("click", () => show(idx + 1));

    window.addEventListener("keydown", (e) => {
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


