import fs from "fs";
import jpeg from "jpeg-js";
import os from "os";
import https from "https";
import http from "http";
import { execFileSync } from "child_process";
import "./take-picture.mjs";

const CFG_PATHS = [
  "/opt/gridbox-agent/config.json",
  "/boot/firmware/gridbox-agent/config.json",
  "/boot/gridbox-agent/config.json"
];
const STATE_PATH = "/var/lib/gridbox-agent/state.json";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function firstExisting(paths){
  for (const p of paths){
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}
function readJson(p){ return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, obj){
  try{
    fs.mkdirSync("/var/lib/gridbox-agent", { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  } catch {}
}
function loadState(){
  try{
    const s = readJson(STATE_PATH);
    return { door: s?.door || "unknown" };
  } catch {
    return { door: "unknown" };
  }
}
function saveState(st){ writeJson(STATE_PATH, st); }

function readCfg(){
  const cfgPath = firstExisting(CFG_PATHS);
  if (!cfgPath) throw new Error("Geen config.json gevonden");
  const cfg = readJson(cfgPath);
  if (!cfg.apiBaseUrl) throw new Error("config mist apiBaseUrl");
  if (!cfg.boxId) throw new Error("config mist boxId");

  cfg.apiBaseUrl = String(cfg.apiBaseUrl).replace(/\/$/, "");
  cfg.pollMs ??= 200;
  cfg.abortCheckMs ??= 100;
  cfg.openDurationMs ??= 30000;
  cfg.closeDurationMs ??= 30000;
  cfg.reverseDelayMs ??= 0;
  cfg.lightAfterCloseMs ??= 30000;

  cfg.hardware = cfg.hardware || { mode: "sim", activeHigh: true };
  cfg.device = cfg.device || {};
  cfg.device.deviceId = cfg.device.deviceId || os.hostname();
  cfg.device.agentName = cfg.device.agentName || "Gridbox Agent";

  cfg.camera = cfg.camera || {};
  cfg.camera.enabled ??= false;
  cfg.camera.intervalSec ??= 3;
  cfg.camera.postCloseSec ??= 30;

  cfg.camera.dedupe = cfg.camera.dedupe || {};
  cfg.camera.dedupe.enabled ??= false;
  cfg.camera.dedupe.threshold ??= 3;     // lager = strenger (minder weg), hoger = meer weg
  cfg.camera.dedupe.minKeepMs ??= 10000; // minstens 1 foto per 10s bewaren
  cfg.camera.dedupe.maskBottomPct ??= 0; // als je ooit toch een balk wil negeren (0 = niets)

  cfg.__cfgPath = cfgPath;
  return cfg;
}

function httpsGetJson(url){
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "Accept": "application/json" }
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: JSON.parse(data) });
        } catch {
          resolve({ ok: false, json: null });
        }
      });
    });
    req.on("error", () => resolve({ ok: false, json: null }));
    req.end();
  });
}

function httpsPostJson(url, bodyObj){
  return new Promise((resolve) => {
    const u = new URL(url);
    const body = JSON.stringify(bodyObj ?? {});
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", c => data += c);
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json });
      });
    });
    req.on("error", () => resolve({ ok: false, status: 0, json: null }));
    req.write(body);
    req.end();
  });
}

function httpGetBuffer(url, user, pass){
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ ok: false, status: 0, buf: null }); }

    const lib = (u.protocol === "https:") ? https : http;
    const headers = {};
    if (user || pass){
      const token = Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${token}`;
    }

    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "GET",
      headers
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, buf });
      });
    });

    req.on("error", () => resolve({ ok: false, status: 0, buf: null }));
    req.end();
  });
}

function httpPostBinary(url, buf, headers){
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ ok: false, status: 0, json: null }); }

    const lib = (u.protocol === "https:") ? https : http;
    const h = {
      ...headers,
      "Content-Length": Buffer.byteLength(buf)
    };

    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "POST",
      headers: h
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, body });
      });
    });

    req.on("error", () => resolve({ ok: false, status: 0, json: null }));
    req.write(buf);
    req.end();
  });
}

function i2cSet(bus, addr, relay, value){
  execFileSync("i2cset", ["-y", String(bus), String(addr), String(relay), String(value)], { stdio: "ignore" });
}

function makeHw(hw){
  const mode = String(hw.mode || "sim").toLowerCase();
  if (mode !== "i2c"){
    return { openOn(){}, closeOn(){}, motorsOff(){}, light(){} };
  }
  const bus = hw.i2cBus ?? 1;
  const addr = hw.i2cAddress ?? "0x10";
  if (hw.openRelay == null) throw new Error("hardware.openRelay ontbreekt");
  if (hw.closeRelay == null) throw new Error("hardware.closeRelay ontbreekt");
  const lightRelay = hw.lightRelay ?? 0;
  const activeHigh = hw.activeHigh !== false;
  const ON = activeHigh ? "0xFF" : "0x00";
  const OFF = activeHigh ? "0x00" : "0xFF";
  return {
    openOn(){ i2cSet(bus, addr, hw.openRelay, ON); },
    closeOn(){ i2cSet(bus, addr, hw.closeRelay, ON); },
    motorsOff(){
      i2cSet(bus, addr, hw.openRelay, OFF);
      i2cSet(bus, addr, hw.closeRelay, OFF);
    },
    light(on){
      if (!lightRelay) return;
      i2cSet(bus, addr, lightRelay, on ? ON : OFF);
    }
  };
}

function phaseBucket(phase){
  const p = String(phase || "").toLowerCase();
  if (p.includes("close")) return "close"; // closing, post-close, close
  return "open"; // open, opening, ...
}

function dhashHexFromJpeg(buf, maskBottomPct = 0){
  try{
    const decoded = jpeg.decode(buf, { useTArray: true });
    const { width, height, data } = decoded;
    if (!width || !height || !data) return null;

    const effH = Math.max(1, Math.floor(height * (100 - maskBottomPct) / 100));
    const gx = 9;
    const gy = 8;

    function grayAt(ix, iy){
      const x = Math.floor(ix * (width - 1) / (gx - 1));
      const y = Math.floor(iy * (effH - 1) / (gy - 1));
      const idx = (y * width + x) * 4;
      const r = data[idx] || 0;
      const g = data[idx + 1] || 0;
      const b = data[idx + 2] || 0;
      return (r * 299 + g * 587 + b * 114) / 1000;
    }

    let bits = 0n;
    for (let y = 0; y < 8; y++){
      for (let x = 0; x < 8; x++){
        const left = grayAt(x, y);
        const right = grayAt(x + 1, y);
        bits = (bits << 1n) | (left > right ? 1n : 0n);
      }
    }
    return bits.toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

function hammingHex64(aHex, bHex){
  try{
    let x = BigInt("0x" + aHex) ^ BigInt("0x" + bHex);
    let c = 0;
    while (x){
      c += Number(x & 1n);
      x >>= 1n;
    }
    return c;
  } catch {
    return 999;
  }
}

async function main(){
  const cfg = readCfg();
  const hw = makeHw(cfg.hardware);
  const urlBox = `${cfg.apiBaseUrl}/api/boxes/${encodeURIComponent(cfg.boxId)}`;

  let { door } = loadState();
  let moving = false;

  function log(...a){ console.log(`[AGENT ${cfg.boxId}]`, ...a); }

  async function getDesired(){
    const r = await httpsGetJson(urlBox);
    if (!r.ok) return null;
    const d = r.json?.box?.desired;
    if (d === "open" || d === "close") return d;
    return null;
  }

  function startMotor(dir){
    hw.motorsOff();
    if (dir === "open") hw.openOn();
    if (dir === "close") hw.closeOn();
  }

  function lightForState(){
    if (door === "open") hw.light(true);
    if (door === "closed") hw.light(false);
  }

  const camEnabled = cfg.camera?.enabled === true;
  const intervalMs = Math.max(500, Number(cfg.camera?.intervalSec ?? 3) * 1000);
  const postCloseMs = Math.max(0, Number(cfg.camera?.postCloseSec ?? 30) * 1000);

  const dedupeCfg = cfg.camera?.dedupe || {};
  const dedupeEnabled = (dedupeCfg.enabled === true);
  const dedupeThreshold = Math.max(0, Number(dedupeCfg.threshold ?? 3));
  const dedupeMinKeepMs = Math.max(0, Number(dedupeCfg.minKeepMs ?? 10000));
  const dedupeMaskBottomPct = Math.max(0, Math.min(90, Number(dedupeCfg.maskBottomPct ?? 0)));

  let lastHash = { open: null, close: null };
  let lastKeepAt = { open: 0, close: 0 };

  function decideSkip(phase, jpgBuf){
    if (!dedupeEnabled) return { skip: false, dist: null, hash: null, bucket: null };

    const b = phaseBucket(phase);
  const p = String(phase || "").toLowerCase();
  if (p.includes("opening") || p.includes("closing")){
    return { skip: false, dist: null, hash: null, bucket: b };
  }

    const h = dhashHexFromJpeg(jpgBuf, dedupeMaskBottomPct);
    if (!h) return { skip: false, dist: null, hash: null, bucket: b };

    const now = Date.now();
    const prev = lastHash[b];

    if (prev && (now - lastKeepAt[b]) < dedupeMinKeepMs){
      const dist = hammingHex64(prev, h);
      if (dist <= dedupeThreshold){
        return { skip: true, dist, hash: h, bucket: b };
      }
      return { skip: false, dist, hash: h, bucket: b };
    }
    return { skip: false, dist: null, hash: h, bucket: b };
  }

  function markKept(bucket, hash){
    if (!bucket || !hash) return;
    lastHash[bucket] = hash;
    lastKeepAt[bucket] = Date.now();
  }

  const capture = {
    running: false,
    sessionId: null,
    seq: 1,
    phase: "open",
    timer: null,
    stopTimer: null,
    busy: false
  };

  function setPhase(p){ capture.phase = p; }

  function clearStopTimer(){
    if (capture.stopTimer){
      clearTimeout(capture.stopTimer);
      capture.stopTimer = null;
    }
  }

  function stopLoopTimer(){
    if (capture.timer){
      clearTimeout(capture.timer);
      capture.timer = null;
    }
  }

  function scheduleNextShot(delayMs){
    if (!capture.running) return;
    stopLoopTimer();
    capture.timer = setTimeout(async () => {
      if (!capture.running) return;

      if (capture.busy){
        scheduleNextShot(200);
        return;
      }

      capture.busy = true;
      try{
        const camUrl = cfg.camera?.url || "";
        if (!camUrl){
          log("FAIL: camera url ontbreekt");
          capture.seq += 1;
          return;
        }

        const snap = await httpGetBuffer(camUrl, cfg.camera?.user || "", cfg.camera?.pass || "");
        if (!snap.ok || !snap.buf || snap.buf.length < 100){
          log("FAIL: snapshot", { status: snap.status });
          capture.seq += 1;
          return;
        }

        const d = decideSkip(capture.phase, snap.buf);
        if (d.skip){
          log("SKIP: duplicate", { seq: capture.seq, phase: capture.phase, dist: d.dist });
          capture.seq += 1;
          return;
        }

        const frameUrl = `${cfg.apiBaseUrl}/api/boxes/${encodeURIComponent(cfg.boxId)}/capture/${encodeURIComponent(capture.sessionId)}/frame`;
        const ts = new Date().toISOString();

        const r = await httpPostBinary(frameUrl, snap.buf, {
          "Accept": "application/json",
          "Content-Type": "image/jpeg",
          "X-Seq": String(capture.seq),
          "X-Phase": String(capture.phase),
          "X-Timestamp": ts
        });

        if (r.ok) {
          log("OK: uploaded", { seq: capture.seq, phase: capture.phase, dist: d.dist ?? null });
          if (d.bucket && d.hash) markKept(d.bucket, d.hash);
        } else {
          log("FAIL: upload", { status: r.status, body: (r.body || "").slice(0, 200) });
        }

        capture.seq += 1;
      } finally {
        capture.busy = false;
      }

      scheduleNextShot(intervalMs);
    }, Math.max(0, Number(delayMs) || 0));
  }

  async function startCaptureIfNeeded(){
    if (!camEnabled) return;
    if (capture.running) return;

    const startUrl = `${cfg.apiBaseUrl}/api/boxes/${encodeURIComponent(cfg.boxId)}/capture/start`;
    const r = await httpsPostJson(startUrl, { intervalMs, postCloseMs });
    if (!r.ok || !r.json?.sessionId){
      log("capture start mislukt", r.status, r.json);
      return;
    }

    capture.running = true;
    capture.sessionId = r.json.sessionId;
    capture.seq = 1;
    capture.busy = false;

    // reset dedupe per session
    lastHash = { open: null, close: null };
    lastKeepAt = { open: 0, close: 0 };

    log("capture gestart", { sessionId: capture.sessionId, intervalMs, postCloseMs, dedupeEnabled, dedupeThreshold, dedupeMinKeepMs });

    scheduleNextShot(0);
  }

  async function stopCaptureNow(){
    if (!capture.running) return;

    const stopUrl = `${cfg.apiBaseUrl}/api/boxes/${encodeURIComponent(cfg.boxId)}/capture/${encodeURIComponent(capture.sessionId)}/stop`;
    const r = await httpsPostJson(stopUrl, {});
    log("capture stop", r.ok ? "ok" : "fail", r.status, r.json);

    capture.running = false;
    capture.sessionId = null;
    capture.seq = 1;
    capture.busy = false;

    stopLoopTimer();
    clearStopTimer();
  }

  hw.motorsOff();
  lightForState();
  log("boot", { cfgPath: cfg.__cfgPath, door, camEnabled, intervalMs, postCloseMs, dedupeEnabled, dedupeThreshold, dedupeMinKeepMs });

  if (door === "open") {
    setPhase("open");
    await startCaptureIfNeeded();
  }

  async function followDesired(initial){
    moving = true;
    let dir = initial;

    hw.light(true);

    outer: while (true){
      log("motion start", dir);

      if (dir === "open"){
        clearStopTimer();
        setPhase("opening");
        await startCaptureIfNeeded();
      }

      if (dir === "close"){
        clearStopTimer();
        if (capture.running) setPhase("closing");
      }

      startMotor(dir);

      const end = Date.now() + (dir === "open" ? cfg.openDurationMs : cfg.closeDurationMs);

      while (Date.now() < end){
        await sleep(cfg.abortCheckMs);
        const d = await getDesired();
        if (d && d !== dir){
          log("desired changed", { from: dir, to: d });
          hw.motorsOff();
          if (cfg.reverseDelayMs > 0) await sleep(cfg.reverseDelayMs);
          dir = d;
          continue outer;
        }
      }

      hw.motorsOff();

      if (dir === "open"){
        door = "open";
        saveState({ door });
        hw.light(true);
        setPhase("open");
        log("klaar open");
        break;
      }

      if (dir === "close"){
        door = "closed";
        saveState({ door });
        log("klaar closed");

        if (capture.running){
          setPhase("post-close");
          clearStopTimer();
          capture.stopTimer = setTimeout(() => {
            stopCaptureNow().catch(() => {});
          }, postCloseMs);
        }

        const lightEnd = Date.now() + cfg.lightAfterCloseMs;
        while (Date.now() < lightEnd){
          await sleep(cfg.abortCheckMs);
          const d = await getDesired();
          if (d === "open"){
            log("desired changed during post-close", { to: "open" });
            dir = "open";
            continue outer;
          }
        }

        hw.light(false);
        break;
      }
    }

    moving = false;
  }

  while (true){
    await sleep(cfg.pollMs);
    if (moving) continue;

    const d = await getDesired();
    if (!d) continue;
    if (d === "open" && door === "open") continue;
    if (d === "close" && door === "closed") continue;

    await followDesired(d);
  }
}

main().catch(e => {
  console.error("[AGENT] FATAAL", e);
  process.exit(1);
});
