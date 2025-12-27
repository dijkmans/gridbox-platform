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
  if (["opening", "open", "closing", "post-close"].includes(s)) return s;
  return "unknown";
}

function pad6(n) {
  const x = Math.max(0, Number(n) || 0);
  return String(x).padStart(6, "0");
}

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

router.get("/:sessionId", async (req, res) => {
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

    return res.json({ ok: true, session: snap.data() });
  } catch (e) {
    console.error("capture/get error", e);
    return res.status(500).json({ ok: false, error: "Interne serverfout" });
  }
});

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
