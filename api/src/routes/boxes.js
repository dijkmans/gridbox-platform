import { Router } from "express";
import { Storage } from "@google-cloud/storage";
import { db } from "../firebase.js";
import { toBoxDto } from "../dto/boxDto.js";
import { buildShareSms } from "../utils/shareMessages.js";
import { sendSms } from "../services/birdSmsService.js";

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

      // desired + captureNonce expliciet in box zetten
      dto.box = {
        ...dto.box,
        desired: data.box?.desired ?? null,
        desiredAt: data.box?.desiredAt ?? null,
        desiredBy: data.box?.desiredBy ?? null,

        // nonce voor "take picture" (agent leest dit)
        captureNonce: data.box?.captureNonce ?? 0,
        captureRequestedAt: data.box?.captureRequestedAt ?? null,
        captureRequestedBy: data.box?.captureRequestedBy ?? null
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

    dto.box = {
      ...dto.box,
      desired: data.box?.desired ?? null,
      desiredAt: data.box?.desiredAt ?? null,
      desiredBy: data.box?.desiredBy ?? null,

      captureNonce: data.box?.captureNonce ?? 0,
      captureRequestedAt: data.box?.captureRequestedAt ?? null,
      captureRequestedBy: data.box?.captureRequestedBy ?? null
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
 * GET /api/boxes/:id/pictures/latest
 * Kleine helper voor de portal: geeft de nieuwste session + nieuwste foto terug.
 * Handig om "Neem foto" te laten wachten tot er echt een nieuwe foto is.
 */
router.get("/:id/pictures/latest", async (req, res) => {
  try {
    const boxId = req.params.id;

    const storage = new Storage();
    const bucketName = requireCaptureBucket();
    const bucket = storage.bucket(bucketName);

    const sessionsPrefix = `boxes/${boxId}/sessions/`;

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
      return res.json({
        ok: false,
        boxId,
        reason: "no_sessions"
      });
    }

    const requested = (req.query.sessionId || "").toString().trim();
    const sessionId = requested && sessions.includes(requested) ? requested : sessions[0];

    const rawPrefix = `boxes/${boxId}/sessions/${sessionId}/raw/`;
    const [files] = await bucket.getFiles({
      prefix: rawPrefix,
      maxResults: 500,
      autoPaginate: false
    });

    const jpgs = (files || []).filter(f => f.name.endsWith(".jpg"));
    if (!jpgs.length) {
      return res.json({
        ok: true,
        boxId,
        sessionId,
        lastObject: null,
        lastName: null,
        lastTs: null
      });
    }

    jpgs.sort((a, b) => b.name.localeCompare(a.name));
    const f = jpgs[0];

    const object = f.name;
    const name = object.split("/").pop();
    const ts = f.metadata?.metadata?.ts || f.metadata?.timeCreated || f.metadata?.updated || null;

    return res.json({
      ok: true,
      boxId,
      sessionId,
      lastObject: object,
      lastName: name,
      lastTs: ts
    });
  } catch (e) {
    console.error("pictures/latest error", e);
    return res.status(500).json({ ok: false, error: "Interne serverfout" });
  }
});

/**
 * GET /api/boxes/:id/pictures
 */
router.get("/:id/pictures", async (req, res) => {
  try {
    const boxId = req.params.id;

    // 1. Haal de box-status op uit Firestore
    const boxSnap = await db.collection("boxes").doc(boxId).get();
    const boxData = boxSnap.exists ? boxSnap.data() : null;
    const currentState = boxData?.status?.state || "onbekend";

    // 2. Setup Storage
    const storage = new Storage();
    const bucketName = requireCaptureBucket();
    const bucket = storage.bucket(bucketName);

    const sessionsPrefix = `boxes/${boxId}/sessions/`;

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
    :root{
      --brand:#2563eb;
      --brand2:#0ea5e9;
      --bg:#f6f9ff;
      --card:#ffffff;
      --line:#e5e7eb;
      --txt:#0f172a;
      --muted:#64748b;
    }

    *{box-sizing:border-box}
    body{
      font-family:system-ui,Arial;
      margin:0;
      color:var(--txt);
      background:linear-gradient(180deg,var(--bg),#ffffff 60%);
    }

    .container{max-width:1200px;margin:0 auto;padding:14px 16px 28px}

    header{
      position:sticky;
      top:0;
      z-index:50;
      background:rgba(255,255,255,.92);
      backdrop-filter:saturate(150%) blur(6px);
      border-bottom:1px solid var(--line);
    }

    .topbar{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
      padding:12px 16px;
      max-width:1200px;
      margin:0 auto;
    }

    .title{
      display:flex;
      gap:10px;
      align-items:baseline;
      margin-right:6px;
    }

    h2{margin:0;font-size:20px}
    .muted{color:var(--muted)}
    .status-badge {
        font-size: 13px;
        font-weight: 500;
        padding: 2px 8px;
        background: #e2e8f0;
        border-radius: 99px;
        color: #475569;
    }

    label{display:flex;gap:6px;align-items:center}
    select,button{
      padding:8px 10px;
      font-size:14px;
      border-radius:10px;
      border:1px solid var(--line);
      background:#fff;
    }

    input[type="checkbox"]{accent-color:var(--brand)}

    button{
      cursor:pointer;
      transition:transform .05s ease, box-shadow .15s ease, background .15s ease;
    }
    button:active{transform:scale(.98)}
    button.primary{
      background:linear-gradient(90deg,var(--brand),var(--brand2));
      color:#fff;
      border:0;
      box-shadow:0 6px 18px rgba(37,99,235,.18);
    }
    button.camera{
      background:linear-gradient(90deg,#10b981,#059669);
      color:#fff;
      border:0;
      box-shadow:0 6px 18px rgba(16,185,129,.18);
    }
    button.ghost{background:#fff}

    .hint{
      margin-left:auto;
      font-size:12px;
      color:var(--muted);
      font-style:italic;
    }

    .stats{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin:14px 0 12px;
    }
    .stat{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:14px;
      padding:14px 14px;
      box-shadow:0 10px 24px rgba(15,23,42,.05);
    }
    .stat .k{font-size:12px;color:var(--muted)}
    .stat .v{font-size:28px;font-weight:700;margin-top:4px}
    .stat.u{border-color:rgba(16,185,129,.25);background:linear-gradient(180deg,rgba(16,185,129,.12),#fff)}
    .stat.d{border-color:rgba(245,158,11,.25);background:linear-gradient(180deg,rgba(245,158,11,.12),#fff)}
    .stat.t{border-color:rgba(59,130,246,.25);background:linear-gradient(180deg,rgba(59,130,246,.12),#fff)}

    .grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(360px,1fr));
      gap:16px;
    }
    .grid img{
      width:100%;
      height:280px;
      object-fit:cover;
      border-radius:16px;
      background:#e5e7eb;
      border:1px solid rgba(0,0,0,.06);
      box-shadow:0 10px 22px rgba(15,23,42,.08);
    }

    .thumbwrap{display:flex;flex-direction:column;gap:8px}
    .thumb-meta{font-size:13px;color:var(--muted)}

    .thumb{display:block;position:relative}
    .dup-badge{
      position:absolute;
      top:10px;
      left:10px;
      background:rgba(37,99,235,.88);
      color:#fff;
      font-size:12px;
      padding:4px 10px;
      border-radius:999px;
      z-index:2;
      user-select:none;
      box-shadow:0 10px 18px rgba(37,99,235,.2);
    }
    .thumbwrap.is-dup-hidden{display:none}

    .lb.hidden{display:none}
    .lb{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center}
    .lb-backdrop{position:absolute;inset:0;background:rgba(2,6,23,.78)}
    .lb-panel{position:relative;max-width:min(1200px,95vw);max-height:92vh;z-index:1}
    .lb-img{max-width:95vw;max-height:82vh;display:block;border-radius:16px;background:#111}
    .lb-caption{color:#fff;opacity:.88;margin-top:10px;font-size:14px}
    .lb-btn{
      position:absolute;
      top:50%;
      transform:translateY(-50%);
      background:rgba(0,0,0,.55);
      color:#fff;
      border:0;
      border-radius:12px;
      padding:10px 14px;
      cursor:pointer;
      font-size:18px
    }
    .lb-prev{left:-52px}
    .lb-next{right:-52px}
    .lb-close{top:-46px;right:0;transform:none}

    @media (max-width:900px){
      .stats{grid-template-columns:1fr}
      .grid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
      .grid img{height:220px}
      .hint{width:100%;margin-left:0}
    }
    @media (max-width:700px){
      .lb-prev{left:6px}
      .lb-next{right:6px}
      .lb-close{top:6px;right:6px}
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div class="title">
        <h2>Pictures</h2>
        <div class="muted">Box: ${esc(boxId)} <span class="status-badge">${esc(currentState)}</span></div>
      </div>

      <button id="takePic" class="camera" type="button">📸 Neem foto</button>

      <label style="margin-left:12px">
        Session
        <select id="sess">${options}</select>
      </label>
      <button id="go" class="ghost" type="button">Open</button>

      <label>
        <input type="checkbox" id="advTol">
        Andere tolerantie
      </label>

      <label id="tolWrap" style="display:none">
        Tolerantie
        <select id="tol" disabled>
          <option value="strict">Streng (32x32)</option>
          <option value="normal">Normaal (16x16)</option>
          <option value="loose" selected>Los (8x8)</option>
        </select>
      </label>

      <button id="scan" class="primary" type="button">Zoek dubbels</button>

      <label>
        <input type="checkbox" id="hideDup" checked>
        Verberg dubbels
      </label>

      <button id="reset" class="ghost" type="button">Reset</button>

      <span id="scanStatus" class="muted"></span>
    </div>
  </header>

  <div class="container">
    <div class="stats">
      <div class="stat u">
        <div class="k">Visueel uniek</div>
        <div class="v" id="statUnique">0</div>
      </div>
      <div class="stat d">
        <div class="k">Dubbels (visueel)</div>
        <div class="v" id="statDup">0</div>
      </div>
      <div class="stat t">
        <div class="k">Totaal verwerkt</div>
        <div class="v" id="statTotal">0</div>
      </div>
    </div>

    <div class="grid">${thumbs}</div>
  </div>

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
    const boxId = "${esc(boxId)}";
    const takePicBtn = document.getElementById("takePic");

    async function getLatestPictureInfo(){
      try{
        const r = await fetch('/api/boxes/' + boxId + '/pictures/latest', { cache: 'no-store' });
        if(!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    }

    takePicBtn.onclick = async () => {
        if(!confirm("Wil je nu een foto nemen met de camera?")) return;

        takePicBtn.disabled = true;
        takePicBtn.textContent = "⏳ Verzoek verstuurd...";

        // neem een "before" snapshot zodat we kunnen zien wanneer er iets nieuws bijkomt
        const before = await getLatestPictureInfo();

        try {
            const res = await fetch('/api/boxes/' + boxId + '/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestedBy: 'portal' })
            });
            if(!res.ok) throw new Error("Fout bij aanvraag");

            const timeoutMs = 25000;
            const t0 = Date.now();
            takePicBtn.textContent = "📸 Wachten op foto... (0s)";

            while (Date.now() - t0 < timeoutMs) {
              await new Promise(r => setTimeout(r, 1000));

              const now = await getLatestPictureInfo();
              const secs = Math.ceil((Date.now() - t0) / 1000);
              takePicBtn.textContent = "📸 Wachten op foto... (" + secs + "s)";

              if (!now || !now.ok) continue;

              const beforeSession = before?.sessionId || null;
              const beforeObj = before?.lastObject || null;

              const sessionChanged = beforeSession && now.sessionId && now.sessionId !== beforeSession;
              const objectChanged = beforeObj && now.lastObject && now.lastObject !== beforeObj;

              // als er geen before was, is "nieuw" zodra we een lastObject zien
              const becameAvailable = (!before || !beforeObj) && !!now.lastObject;

              if (sessionChanged || objectChanged || becameAvailable) {
                const sid = now.sessionId ? encodeURIComponent(now.sessionId) : "";
                if (sid) {
                  window.location.href = window.location.pathname + "?sessionId=" + sid;
                } else {
                  window.location.href = window.location.pathname;
                }
                return;
              }
            }

            alert("Geen nieuwe foto gezien binnen 25 seconden. Probeer opnieuw of kijk naar de logs van de Pi.");
        } catch(e) {
            alert("Er ging iets mis: " + e.message);
        } finally {
            takePicBtn.disabled = false;
            takePicBtn.textContent = "📸 Neem foto";
        }
    };

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

    document.querySelectorAll(".thumb-meta").forEach(el => {
      const ts = el.getAttribute("data-ts") || "";
      el.textContent = fmtTs(ts);
    });

    const tolSel = document.getElementById("tol");
    const advTol = document.getElementById("advTol");
    const tolWrap = document.getElementById("tolWrap");

    const scanBtn = document.getElementById("scan");
    const resetBtn = document.getElementById("reset");
    const hideDup = document.getElementById("hideDup");
    const scanStatus = document.getElementById("scanStatus");

    const statUnique = document.getElementById("statUnique");
    const statDup = document.getElementById("statDup");
    const statTotal = document.getElementById("statTotal");

    const allThumbsEls = Array.from(document.querySelectorAll("a.thumb"));

    let lastGroups = null;

    function applyTolUi(){
      const on = !!advTol.checked;
      tolWrap.style.display = on ? "" : "none";
      tolSel.disabled = !on;
      if (!on) tolSel.value = "loose";
    }

    function tolConfig(){
      const v = tolSel.value;
      if (v === "strict") return { size: 32, step: 32 };
      if (v === "normal") return { size: 16, step: 64 };
      return { size: 8, step: 128 };
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

    function setStats(total, dupCount){
      const unique = Math.max(0, total - dupCount);
      statTotal.textContent = String(total);
      statDup.textContent = String(dupCount);
      statUnique.textContent = String(unique);
    }

    function clearDupMarks(){
      allThumbsEls.forEach(a => {
        const wrap = a.closest(".thumbwrap");
        if (wrap) wrap.classList.remove("is-dup-hidden");
        a.removeAttribute("data-dup-hash");
        const badge = a.querySelector(".dup-badge");
        if (badge){
          badge.hidden = true;
          badge.textContent = "";
        }
      });
      lastGroups = null;
      scanStatus.textContent = "";
      setStats(allThumbsEls.length, 0);
    }

    function applyHideSetting(){
      if (!lastGroups) return;

      allThumbsEls.forEach(a => {
        const w = a.closest(".thumbwrap");
        if (w) w.classList.remove("is-dup-hidden");
      });

      if (!hideDup.checked) return;

      lastGroups.forEach((idxs) => {
        if (!idxs || idxs.length < 2) return;
        for (let k = 1; k < idxs.length; k++){
          const a = allThumbsEls[idxs[k]];
          const w = a && a.closest(".thumbwrap");
          if (w) w.classList.add("is-dup-hidden");
        }
      });
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
        setStats(0, 0);
        return;
      }

      scanBtn.disabled = true;
      tolSel.disabled = true;

      scanStatus.textContent = "Scannen: 0/" + total;
      setStats(total, 0);

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
        }

        done += 1;
        if (done % 6 === 0 || done === total){
          scanStatus.textContent = "Scannen: " + done + "/" + total;
          await new Promise(r => setTimeout(r, 0));
        }
      });

      await runPool(tasks, 4);

      groups.forEach((idxs, h) => {
        idxs.sort((a, b) => a - b);
        groups.set(h, idxs);
      });

      let dupGroups = 0;
      let dupCount = 0;

      groups.forEach((idxs) => {
        if (!idxs || idxs.length < 2) return;
        dupGroups += 1;
        dupCount += (idxs.length - 1);

        const keepA = allThumbsEls[idxs[0]];
        const badge = keepA && keepA.querySelector(".dup-badge");
        if (badge){
          badge.hidden = false;
          badge.textContent = "+" + (idxs.length - 1);
        }
      });

      lastGroups = groups;
      applyHideSetting();
      setStats(total, dupCount);

      scanStatus.textContent = dupGroups
        ? ("Klaar. Groepen: " + dupGroups + ", dubbels: " + dupCount)
        : "Klaar. Geen dubbels gevonden";

      scanBtn.disabled = false;
      tolSel.disabled = !advTol.checked;
    }

    scanBtn.addEventListener("click", scanDuplicates);

    resetBtn.addEventListener("click", () => {
      advTol.checked = false;
      hideDup.checked = true;
      tolSel.value = "loose";
      applyTolUi();
      scanDuplicates();
    });

    hideDup.addEventListener("change", applyHideSetting);

    advTol.addEventListener("change", () => {
      applyTolUi();
      if (!advTol.checked) scanDuplicates();
    });

    tolSel.addEventListener("change", () => {
      if (advTol.checked) scanDuplicates();
    });

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
      return allThumbsEls.filter(a => {
        const w = a.closest(".thumbwrap");
        return !w || !w.classList.contains("is-dup-hidden");
      });
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

    tolSel.value = "loose";
    applyTolUi();

    window.addEventListener("load", () => {
      hideDup.checked = true;
      scanDuplicates();
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

/*
=====================================================
TAKE PICTURE (via nonce in boxes doc)
=====================================================
*/

/**
 * POST /api/boxes/:id/capture
 * We verhogen box.captureNonce in Firestore.
 * De Pi agent ziet dit en neemt exact 1 foto.
 */
router.post("/:id/capture", async (req, res) => {
  try {
    const { id } = req.params;
    const requestedBy = (req.body?.requestedBy || "portal").toString();

    const ref = db.collection("boxes").doc(id);

    let newNonce = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        const err = new Error("Box niet gevonden");
        err.code = "notfound";
        throw err;
      }

      const cur = Number(snap.get("box.captureNonce") ?? 0) || 0;
      newNonce = cur + 1;

      tx.update(ref, {
        "box.captureNonce": newNonce,
        "box.captureRequestedAt": new Date(),
        "box.captureRequestedBy": requestedBy
      });
    });

    res.json({ ok: true, command: "capture", boxId: id, captureNonce: newNonce });
  } catch (err) {
    if (err?.code === "notfound") {
      return res.status(404).json({ ok: false, error: "Box niet gevonden" });
    }
    console.error("Capture (nonce) error:", err);
    res.status(500).json({ ok: false, error: "Interne serverfout" });
  }
});

/* =====================================================
   SHARES ROUTES (Fix voor frontend v19)
   ===================================================== 
*/

// 1. Ophalen van shares voor deze box (VEILIGE VERSIE ZONDER INDEX-FOUT)
router.get("/:id/shares", async (req, res) => {
  try {
    const { id } = req.params;
    
    // We halen ze op ZONDER orderBy om de Firestore Index fout te voorkomen
    const snap = await db.collection("shares")
      .where("boxId", "==", id)
      .where("active", "==", true)
      .get();

    // We maken er een lijst van
    const shares = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // We sorteren ze HIER in de code (nieuwste bovenaan)
    shares.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; 
    });

    res.json(shares);
  } catch (err) {
    console.error("GET shares error:", err);
    res.status(500).json({ error: "Kon shares niet ophalen" });
  }
});

// 2. Nieuwe share toevoegen (MET SMS)
// 2. Nieuwe share toevoegen (MET SMS via Bird)
router.post("/:id/shares", async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, comment, expires, auth } = req.body;

    if (!phone) return res.status(400).json({ error: "Telefoonnummer verplicht" });

    // BoxNumber nodig voor SMS-commando's (open 5)
    const boxSnap = await db.collection("boxes").doc(String(id)).get();
    const boxData = boxSnap.exists ? (boxSnap.data() || {}) : {};
    const boxNumberVal =
      boxData?.Portal?.BoxNumber ??
      boxData?.box?.number ??
      (String(id).match(/^\d+$/) ? Number(id) : null);
    const boxNumber = Number(boxNumberVal);

    if (!Number.isFinite(boxNumber)) {
      return res.status(400).json({ error: "BoxNumber niet gevonden voor deze box. Vul Portal.BoxNumber in Firestore." });
    }

    const newShare = {
      boxId: id,
      boxNumber,
      phone: String(phone).trim(),
      comment: comment || "",
      expiresAt: expires || null,
      type: auth ? "authorized" : "temporary",
      active: true,
      createdAt: new Date().toISOString()
    };

    const ref = await db.collection("shares").add(newShare);

    // SMS versturen (Bird)
    const smsText = buildShareSms({ boxNumber, expiresAt: newShare.expiresAt });
    const smsResult = await sendSms({ to: newShare.phone, body: smsText });

    await db.collection("shares").doc(ref.id).set(
      {
        smsSentAt: smsResult.ok ? new Date().toISOString() : null,
        smsProvider: smsResult.ok ? "bird" : null,
        smsError: smsResult.ok ? null : smsResult.error
      },
      { merge: true }
    );

    res.json({ ok: true, id: ref.id, ...newShare, sms: smsResult });
  } catch (err) {
    console.error("POST share error:", err);
    res.status(500).json({ error: "Kon share niet opslaan" });
  }
});

// 3. Share verwijderen (deactiveren)
router.delete("/:id/shares/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params;
    // We verwijderen niet echt, maar zetten active op false (soft delete)
    await db.collection("shares").doc(shareId).update({ 
      active: false,
      deactivatedAt: new Date().toISOString()
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE share error:", err);
    res.status(500).json({ error: "Kon share niet verwijderen" });
  }
});

export default router;
