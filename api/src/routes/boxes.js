// api/src/routes/boxes.js

import express from "express";
import admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";

const router = express.Router();

// -------------------- COMMANDS (FireStore) --------------------
router.get("/:boxId/commands", async (req, res) => {
  try {
    const { boxId } = req.params;

    const doc = await admin.firestore().collection("boxCommands").doc(boxId).get();
    if (!doc.exists) return res.json(null);

    const data = doc.data() || {};
    return res.json({
      id: data.commandId || "unknown",
      type: data.type || null,
      payload: data.payload || null,
      createdAt: data.createdAt || null
    });
  } catch (err) {
    console.error("GET /api/boxes/:boxId/commands error:", err);
    return res.status(500).json(null);
  }
});

router.post("/:boxId/commands/:commandId/ack", async (req, res) => {
  try {
    const { boxId } = req.params;

    // We verwijderen gewoon het command doc (simpel ack-mechanisme)
    await admin.firestore().collection("boxCommands").doc(boxId).delete().catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/boxes/:boxId/commands/:commandId/ack error:", err);
    return res.status(500).json({ ok: false, error: "ACK mislukt" });
  }
});

// -------------------- PICTURES VIEWER --------------------
router.get("/:boxId/pictures", async (req, res) => {
  try {
    const { boxId } = req.params;
    const sessionId = (req.query.sessionId || "").toString().trim();

    const bucketName = process.env.GCS_BUCKET || process.env.BUCKET_NAME;
    if (!bucketName) {
      return res.status(500).send("GCS_BUCKET ontbreekt");
    }

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    // Sessions = prefixes onder boxes/<boxId>/capture/
    const sessionsPrefix = `boxes/${boxId}/capture/`;
    const [files, , apiResp] = await bucket.getFiles({
      prefix: sessionsPrefix,
      delimiter: "/",
      autoPaginate: false,
      maxResults: 200
    });

    const prefixes = (apiResp?.prefixes || []).map(p => p.replace(sessionsPrefix, "").replace("/", ""));
    prefixes.sort().reverse(); // nieuwste eerst op basis van naam cap_YYYY...

    const sessions = prefixes;

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = sessions[0] || "";
    }

    let items = [];
    if (activeSessionId) {
      const picturesPrefix = `boxes/${boxId}/capture/${activeSessionId}/`;
      const [pics] = await bucket.getFiles({
        prefix: picturesPrefix,
        autoPaginate: false,
        maxResults: 200
      });

      // Alleen .jpg/.jpeg/.png en geen "folders"
      const picFiles = pics
        .filter(f => f.name && !f.name.endsWith("/"))
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f.name));

      // Nieuwste eerst op basis van filename (000123.jpg)
      picFiles.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));

      // Signed URLs + timestamp
      items = await Promise.all(
        picFiles.map(async f => {
          const [url] = await f.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60
          });

          const md = f.metadata || {};
          // md.timeCreated is ISO string
          const ts = md.timeCreated ? new Date(md.timeCreated).getTime() : null;

          return {
            name: f.name.split("/").pop(),
            url,
            ts
          };
        })
      );
    }

    const fmtTs = (ms) => {
      if (!ms) return "";
      const d = new Date(ms);
      const pad = (n) => String(n).padStart(2, "0");
      return (
        pad(d.getDate()) + "/" +
        pad(d.getMonth() + 1) + "/" +
        d.getFullYear() + ", " +
        pad(d.getHours()) + ":" +
        pad(d.getMinutes()) + ":" +
        pad(d.getSeconds())
      );
    };

    const currentTopName = items?.[0]?.name || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pictures</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; }
    .topbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .thumb {
      display: block;
      text-decoration: none;
      color: inherit;
      border-radius: 10px;
      overflow: hidden;
      background: #f1f1f1;
    }
    .thumb img {
      width: 100%;
      height: 140px;
      object-fit: cover;
      display: block;
      border-radius: 10px;
    }
    .thumb-meta {
      font-size: 12px;
      padding: 6px 4px 0 2px;
      color: #333;
    }

    /* Lightbox */
    .lb.hidden { display: none; }
    .lb {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      display: grid;
      place-items: center;
      z-index: 9999;
    }
    .lb-inner {
      position: relative;
      width: min(92vw, 1200px);
      height: min(90vh, 800px);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 8px;
    }
    .lb-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
      font-size: 14px;
      opacity: 0.9;
    }
    .lb-imgwrap {
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 12px;
    }
    .lb-imgwrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .lb-controls {
      display: flex;
      justify-content: center;
      gap: 10px;
    }
    .lb-btn {
      background: rgba(255,255,255,0.12);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      user-select: none;
      font-size: 14px;
    }
    .lb-btn:hover { background: rgba(255,255,255,0.18); }
    .lb-close {
      position: absolute;
      top: -8px;
      right: -8px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.25);
      color: #fff;
      border-radius: 999px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 18px;
    }

    .take-wrap { display: inline-flex; align-items: center; gap: 10px; }
    .take-status { font-size: 13px; color: #444; }
    .take-btn { padding: 6px 10px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="topbar">
    <h2 style="margin:0;">Pictures</h2>
    <div>Box: <b>${boxId}</b></div>

    <div>Session</div>
    <select id="sessionSel">
      ${sessions
        .map(s => `<option value="${s}" ${s === activeSessionId ? "selected" : ""}>${s}</option>`)
        .join("")}
    </select>
    <button id="openBtn">Open</button>

    <div class="take-wrap">
      <button id="takeBtn" class="take-btn">TAKE PICTURE</button>
      <span id="takeStatus" class="take-status"></span>
    </div>
  </div>

  <div class="grid" id="grid">
    ${items
      .map(
        (it) => `
      <a class="thumb" href="${it.url}" data-full="${it.url}" data-name="${it.name}">
        <img src="${it.url}" alt="${it.name}" />
        <div class="thumb-meta">${fmtTs(it.ts)}</div>
      </a>`
      )
      .join("")}
  </div>

  <div class="lb hidden" id="lb">
    <div class="lb-inner">
      <div class="lb-top">
        <div id="lbCaption"></div>
        <div id="lbCounter"></div>
      </div>

      <div class="lb-imgwrap">
        <img id="lbImg" src="" alt="" />
      </div>

      <div class="lb-controls">
        <div class="lb-btn" id="lbPrev">Vorige</div>
        <div class="lb-btn" id="lbNext">Volgende</div>
      </div>

      <button class="lb-close" id="lbClose">×</button>
    </div>

    <div class="lb-btn" id="lbBack" style="position: fixed; left: 16px; top: 16px;">Terug</div>
  </div>

  <script>
    const boxId = ${JSON.stringify(boxId)};
    const currentSessionId = ${JSON.stringify(activeSessionId)};
    const currentTopName = ${JSON.stringify(currentTopName)};

    const sel = document.getElementById("sessionSel");
    const openBtn = document.getElementById("openBtn");

    openBtn.addEventListener("click", () => {
      const sid = sel.value;
      location.href = location.pathname + "?sessionId=" + encodeURIComponent(sid);
    });

    const takeBtn = document.getElementById("takeBtn");
    const takeStatus = document.getElementById("takeStatus");

    async function getNewestSessionId() {
      try {
        let pageToken = null;
        let newest = null;

        // We lopen door alle pages, want de API geeft sessions per page in oplopende prefix-volgorde.
        for (let i = 0; i < 50; i++) {
          const url =
            "/api/boxes/" + encodeURIComponent(boxId) +
            "/capture/sessions?limit=100" +
            (pageToken ? ("&pageToken=" + encodeURIComponent(pageToken)) : "");

          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) return newest;

          const j = await r.json().catch(() => null);
          const s0 = j?.sessions?.[0]?.sessionId || null;
          if (s0) newest = s0;

          pageToken = j?.nextPageToken || null;
          if (!pageToken) break;
        }

        return newest;
      } catch (_) {
        return null;
      }
    }

    async function getLatestPictureName(sessionId) {
      try {
        let pageToken = null;
        let latest = null;

        // In capture.js worden items per page oplopend gesorteerd (oudste eerst).
        // Daarom: laatste item van de laatste page = nieuwste foto.
        for (let i = 0; i < 200; i++) {
          const url =
            "/api/boxes/" + encodeURIComponent(boxId) +
            "/capture/sessions/" + encodeURIComponent(sessionId) +
            "/pictures?limit=500" +
            (pageToken ? ("&pageToken=" + encodeURIComponent(pageToken)) : "");

          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) return latest;

          const j = await r.json().catch(() => null);
          const items = Array.isArray(j?.items) ? j.items : [];
          if (items.length) {
            const last = items[items.length - 1];
            if (last?.name) latest = last.name;
          }

          pageToken = j?.nextPageToken || null;
          if (!pageToken) break;
        }

        return latest;
      } catch (_) {
        return null;
      }
    }

    async function waitForNewPicture(timeoutMs = 20000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        // 1) eerst check: kwam er iets nieuws in de huidige session?
        const latestName = await getLatestPictureName(currentSessionId);
        if (latestName && latestName !== currentTopName) {
          return { sessionId: currentSessionId };
        }

        // 2) anders: is er een nieuwe session gestart?
        const newest = await getNewestSessionId();
        if (newest && newest !== currentSessionId) {
          const newName = await getLatestPictureName(newest);
          if (newName) return { sessionId: newest };
        }

        await new Promise(r => setTimeout(r, 1000));
      }
      return null;
    }

    takeBtn?.addEventListener("click", async () => {
      takeBtn.disabled = true;
      try {
        takeStatus.textContent = "Foto vragen...";
        const cmdUrl = "/api/boxes/" + encodeURIComponent(boxId) + "/pictures/take";
        const r = await fetch(cmdUrl, { method: "POST" });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Command mislukt");

        takeStatus.textContent = "Wachten op foto...";
        const got = await waitForNewPicture(20000);
        if (!got?.sessionId) throw new Error("Geen foto binnen 20 seconden");

        location.href = location.pathname + "?sessionId=" + encodeURIComponent(got.sessionId);
      } catch (e) {
        alert("Kon geen foto nemen: " + (e?.message || e));
      } finally {
        takeBtn.disabled = false;
        takeStatus.textContent = "";
      }
    });

    // Lightbox logic
    const thumbsEls = Array.from(document.querySelectorAll("a.thumb"));
    const lb = document.getElementById("lb");
    const lbImg = document.getElementById("lbImg");
    const lbCaption = document.getElementById("lbCaption");
    const lbCounter = document.getElementById("lbCounter");
    const lbBack = document.getElementById("lbBack");
    const lbClose = document.getElementById("lbClose");
    const lbPrev = document.getElementById("lbPrev");
    const lbNext = document.getElementById("lbNext");

    let idx = -1;

    function show(i) {
      if (!thumbsEls.length) return;
      if (i < 0) i = thumbsEls.length - 1;
      if (i >= thumbsEls.length) i = 0;
      idx = i;

      const a = thumbsEls[idx];
      const url = a.getAttribute("data-full") || a.href;
      const name = a.getAttribute("data-name") || "";

      lbImg.src = url;
      lbCaption.textContent = name;
      lbCounter.textContent = (idx + 1) + " / " + thumbsEls.length;

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
  } catch (err) {
    console.error("GET /api/boxes/:boxId/pictures error:", err);
    res.status(500).send("Fout bij laden pictures");
  }
});

// -------------------- TAKE PICTURE COMMAND --------------------
router.post("/:boxId/pictures/take", async (req, res) => {
  try {
    const { boxId } = req.params;

    const commandId = "take_" + Date.now();
    await admin.firestore().collection("boxCommands").doc(boxId).set({
      commandId,
      type: "take_picture",
      payload: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true, commandId });
  } catch (err) {
    console.error("POST /api/boxes/:boxId/pictures/take error:", err);
    return res.status(500).json({ ok: false, error: "Kon command niet zetten" });
  }
});

export default router;
