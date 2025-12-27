import express from "express";
import crypto from "crypto";
import { Storage } from "@google-cloud/storage";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase.js";

const router = express.Router({ mergeParams: true });

function requireDb() {
  if (!db) throw new Error("Firestore db is niet beschikbaar.");
  return db;
}

function requireBucketName() {
  const name = process.env.CAPTURE_BUCKET;
  if (!name) throw new Error("CAPTURE_BUCKET ontbreekt (env var).");
  return name;
}

function newSessionId() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const rnd = crypto.randomBytes(3).toString("hex");
  return `cap_${ts}_${rnd}`;
}

function normPhase(v) {
  const s = String(v || "").toLowerCase().trim();
  if (["opening", "open", "closing", "post-close", "close"].includes(s)) return s;
  return "unknown";
}

function pad6(n) {
  const x = Math.max(0, Number(n) || 0);
  return String(x).padStart(6, "0");
}

function sessionIdToIso(sessionId) {
  // cap_YYYYMMDDHHMMSSmmm_xxxxxx
  const m = /^cap_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})_/.exec(String(sessionId || ""));
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

/**
 * START: maakt een nieuwe capture session in Firestore
 */
router.post("/start", async (req, res) => {
  try {
    const dbx = requireDb();
    const { boxId } = req.params;

    const intervalMs = Number(req.body?.intervalMs ?? 500);
    const postCloseMs = Number(req.body?.postCloseMs ?? 30000);

    const sessionId = newSessionId();
    const docRef = dbx.collection("captureSessions").doc(sessionId);

    await docRef.set({
      boxId,
      sessionId,
      status: "active",
      intervalMs,
      postCloseMs,
      startedAt: new Date().toISOString(),
      endedAt: null,
      frameCount: 0,
      lastSeq: null,
      lastFrameAt: null
    });

    const check = await docRef.get();
    if (!check.exists) {
      throw new Error("Session werd niet opgeslagen (check failed).");
    }

    return res.json({ ok: true, sessionId });
  } catch (e) {
    console.error("capture/start error", e);
    return res.status(500).json({ ok: false, error: String(e?.message || "Interne serverfout") });
  }
});

/**
 * SESSIONS: lijst met sessies voor 1 box, rechtstreeks uit GCS
 * GET /api/boxes/:boxId/capture/sessions?limit=25&pageToken=...
 */
router.get("/sessions", async (req, res) => {
  try {
    const { boxId } = req.params;

    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 25)));
    const pageToken = String(req.query.pageToken || "").trim() || undefined;

    const bucketName = requireBucketName();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    const prefix = `boxes/${boxId}/sessions/`;

    // Belangrijk: delimiter "/" zodat we "folders" (sessions) krijgen
    const [_files, nextQuery, apiResp] = await bucket.getFiles({
      prefix,
      delimiter: "/",
      maxResults: limit,
      pageToken,
      autoPaginate: false
    });

    const prefixes = (apiResp && apiResp.prefixes) ? apiResp.prefixes : [];

    const sessionIds = prefixes
      .map(p => p.slice(prefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));

    if (!sessionIds.length) {
      return res.status(404).json({ ok: false, error: "Session niet gevonden" });
    }

    // We geven een basis object terug. Extra info kan later uit Firestore komen als je wil.
    const sessions = sessionIds.map(id => ({
      sessionId: id,
      boxId,
      status: null,
      startedAt: sessionIdToIso(id),
      endedAt: null,
      durationSec: null,
      frameCount: null,
      intervalMs: null,
      postCloseMs: null,
      lastSeq: null,
      lastFrameAt: null
    }));

    const nextPageToken = nextQuery?.pageToken || apiResp?.nextPageToken || null;

    return res.json({ ok: true, sessions, nextPageToken });
  } catch (e) {
    console.error("capture/sessions error", e);
    return res.status(500).json({ ok: false, error: String(e?.message || "Interne serverfout") });
  }
});

/**
 * PICTURES: lijst van pictures in GCS voor 1 session (met signed urls)
 * GET /api/boxes/:boxId/capture/sessions/:sessionId/pictures?limit=100&pageToken=...
 */
router.get("/sessions/:sessionId/pictures", async (req, res) => {
  try {
    const dbx = requireDb();
    const { boxId, sessionId } = req.params;

    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 100)));
    const pageToken = String(req.query.pageToken || "").trim() || undefined;

    // Als Firestore doc bestaat, check boxId. Als het niet bestaat, geen probleem: oude sessions zitten enkel in GCS.
    try {
      const docRef = dbx.collection("captureSessions").doc(sessionId);
      const snap = await docRef.get();
      if (snap.exists && snap.data()?.boxId && snap.data()?.boxId !== boxId) {
        return res.status(400).json({ ok: false, error: "boxId past niet bij sessionId" });
      }
    } catch (err) {
      // Firestore mag hier niet blokkeren
      console.warn("capture/pictures firestore check skipped:", err?.message || err);
    }

    const bucketName = requireBucketName();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    const prefix = `boxes/${boxId}/sessions/${sessionId}/raw/`;

    const [files, nextQuery, apiResp] = await bucket.getFiles({
      prefix,
      maxResults: limit,
      pageToken,
      autoPaginate: false
    });

    const nextPageToken = nextQuery?.pageToken || apiResp?.nextPageToken || null;

    if (!files || files.length === 0) {
      return res.status(404).json({ ok: false, error: "Geen foto's gevonden voor deze session" });
    }

    const expires = Date.now() + 10 * 60 * 1000;

    const jpgs = files
      .filter(f => f.name.endsWith(".jpg"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const items = await Promise.all(
      jpgs.map(async (f) => {
        const name = f.name.split("/").pop();
        const [url] = await f.getSignedUrl({ action: "read", expires });
        return { name, url };
      })
    );

    return res.json({
      ok: true,
      sessionId,
      items,
      nextPageToken
    });
  } catch (e) {
    console.error("capture/session pictures error", e);
    return res.status(500).json({ ok: false, error: String(e?.message || "Interne serverfout") });
  }
});

/**
 * GET: details van 1 session
 * Eerst Firestore, en als dat niet bestaat: fallback naar GCS (als folder bestaat).
 */
router.get("/:sessionId", async (req, res) => {
  try {
    const dbx = requireDb();
    const { boxId, sessionId } = req.params;

    const docRef = dbx.collection("captureSessions").doc(sessionId);
    const snap = await docRef.get();

    if (snap.exists) {
      if (snap.data()?.boxId !== boxId) {
        return res.status(400).json({ ok: false, error: "boxId past niet bij sessionId" });
      }
      return res.json({ ok: true, session: snap.data() });
    }

    // Fallback naar GCS: bestaat de session folder?
    const bucketName = requireBucketName();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    const prefix = `boxes/${boxId}/sessions/${sessionId}/raw/`;
    const [files] = await bucket.getFiles({ prefix, maxResults: 1, autoPaginate: false });

    if (!files || files.length === 0) {
      return res.status(404).json({ ok: false, error: "Session niet gevonden" });
    }

    return res.json({
      ok: true,
      session: {
        sessionId,
        boxId,
        status: null,
        startedAt: sessionIdToIso(sessionId),
        endedAt: null,
        durationSec: null,
        frameCount: null,
        intervalMs: null,
        postCloseMs: null,
        lastSeq: null,
        lastFrameAt: null
      }
    });
  } catch (e) {
    console.error("capture/get error", e);
    return res.status(500).json({ ok: false, error: "Interne serverfout" });
  }
});

/**
 * FRAME: ontvangt 1 jpeg en bewaart hem in GCS + update Firestore counters
 */
router.post(
  "/:sessionId/frame",
  express.raw({ type: ["image/jpeg", "application/octet-stream"], limit: "8mb" }),
  async (req, res) => {
    try {
      const dbx = requireDb();
      const { boxId, sessionId } = req.params;

      const seq = pad6(req.headers["x-seq"]);
      const phase = normPhase(req.headers["x-phase"]);
      const ts = String(req.headers["x-timestamp"] || new Date().toISOString());

      if (!req.body || !Buffer.isBuffer(req.body) || req.body.length < 10) {
        return res.status(400).json({ ok: false, error: "Lege of ongeldige jpeg body" });
      }

      const docRef = dbx.collection("captureSessions").doc(sessionId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ ok: false, error: "Session niet gevonden" });
      }
      if (snap.data()?.boxId !== boxId) {
        return res.status(400).json({ ok: false, error: "boxId past niet bij sessionId" });
      }

      const bucketName = requireBucketName();
      const storage = new Storage();
      const bucket = storage.bucket(bucketName);

      const filePath = `boxes/${boxId}/sessions/${sessionId}/raw/${seq}.jpg`;
      const file = bucket.file(filePath);

      await file.save(req.body, {
        resumable: false,
        contentType: "image/jpeg",
        metadata: {
          cacheControl: "no-store",
          metadata: { boxId, sessionId, seq, phase, ts }
        }
      });

      await docRef.update({
        frameCount: FieldValue.increment(1),
        lastSeq: Number(req.headers["x-seq"] || 0),
        lastFrameAt: new Date().toISOString()
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error("capture/frame error", e);
      return res.status(500).json({ ok: false, error: "Interne serverfout" });
    }
  }
);

/**
 * STOP: sluit session af
 */
router.post("/:sessionId/stop", async (req, res) => {
  try {
    const dbx = requireDb();
    const { boxId, sessionId } = req.params;

    const docRef = dbx.collection("captureSessions").doc(sessionId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "Session niet gevonden" });
    }
    if (snap.data()?.boxId !== boxId) {
      return res.status(400).json({ ok: false, error: "boxId past niet bij sessionId" });
    }

    await docRef.update({
      status: "closed",
      endedAt: new Date().toISOString()
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("capture/stop error", e);
    return res.status(500).json({ ok: false, error: "Interne serverfout" });
  }
});

export default router;
