<!--
============================================================
GRIDBOX PLATFORM – FUNCTIONELE VASTLEGGING (NIET VERWIJDEREN)
============================================================

Dit HTML-bestand maakt deel uit van het Gridbox-platform
en is functioneel gekoppeld aan de Raspberry Pi agent
(westpiwpy-agent – desired-gestuurd).

BELANGRIJK PRINCIPE
-------------------
De aansturing van de Gridbox gebeurt EXCLUSIEF via:
  Firestore veld: box.desired

Toegelaten waarden:
  - "open"
  - "close"

De Raspberry Pi:
  - leest periodiek box.desired
  - vergelijkt met de actuele toestand
  - voert exact één actie uit indien nodig
  - stuurt status terug
  - voert GEEN command-queue uit
  - voert GEEN lokale beslissingen uit buiten desired

STRICTE REGELS
--------------
- Deze HTML mag GEEN eigen logica toevoegen die
  de betekenis van box.desired wijzigt.
- Deze HTML mag GEEN alternatieve open/close logica invoeren.
- Elke UI-actie die een beweging veroorzaakt MOET
  box.desired aanpassen en niets anders.
- Er mag nooit rechtstreeks hardware of timing
  in deze HTML worden verondersteld.

DOEL VAN DIT PROGRAMMA
---------------------
Dit programma dient als:
- visuele representatie van de Gridbox toestand
- invoerpunt voor box.desired
- referentie-implementatie voor simulator en echte hardware

AFWIJKINGEN
-----------
Elke wijziging aan deze structuur is een
architecturale wijziging en moet bewust gebeuren.
Geen tijdelijke hacks. Geen shortcuts.

Dit comment-blok is een vaste referentie en
moet bij herprogrammeren altijd in rekening
worden gehouden.

============================================================
EINDE VASTLEGGING
============================================================
-->

import fs from "fs";
import os from "os";
import https from "https";
import { execFileSync } from "child_process";

/* --------------------------------------------------
   Basis helpers
-------------------------------------------------- */

function bootDir(){
  if (fs.existsSync("/boot/firmware")) return "/boot/firmware";
  return "/boot";
}

const CFG_PATH = `${bootDir()}/gridbox-agent/config.json`;
const AGENT_VERSION = "westpiwpy-agent-0.4.0-desired";

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function nowIso(){ return new Date().toISOString(); }

/* --------------------------------------------------
   Config lezen
-------------------------------------------------- */

function readCfg(){
  const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
  if (!cfg.apiBaseUrl) throw new Error("config mist apiBaseUrl");
  if (!cfg.boxId) throw new Error("config mist boxId");

  cfg.apiBaseUrl = String(cfg.apiBaseUrl).replace(/\/$/, "");
  cfg.device = cfg.device || {};
  cfg.device.deviceId = cfg.device.deviceId || os.hostname();
  cfg.device.sdTag = cfg.device.sdTag || "SD-UNKNOWN";
  cfg.hardware = cfg.hardware || { mode: "sim", activeHigh: true };

  cfg.openDurationMs ??= 30000;
  cfg.closeDurationMs ??= 30000;
  cfg.lightAfterCloseMs ??= 60000;
  cfg.directionSwitchDelayMs ??= 2000;
  cfg.pollMs ??= 1500;

  return cfg;
}

/* --------------------------------------------------
   HTTP helpers
-------------------------------------------------- */

function httpsRequest(url, method, bodyObj){
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = bodyObj ? Buffer.from(JSON.stringify(bodyObj), "utf8") : null;

    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: {
        "Accept": "application/json",
        ...(body ? { "Content-Type": "application/json", "Content-Length": body.length } : {})
      }
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", c => data += c);
      res.on("end", () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        text: data
      }));
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function httpGet(url){
  try{
    const r = await httpsRequest(url, "GET");
    if (!r.ok) return { ok: false, json: null };
    return { ok: true, json: JSON.parse(r.text) };
  } catch{
    return { ok: false, json: null };
  }
}

async function httpPost(url, body){
  try{
    const r = await httpsRequest(url, "POST", body || {});
    return r.ok;
  } catch{
    return false;
  }
}

/* --------------------------------------------------
   I2C helpers
-------------------------------------------------- */

function i2cOn(bus, addr, relay){
  execFileSync("i2cset", ["-y", String(bus), String(addr), String(relay), "0xFF"]);
}

function i2cOff(bus, addr, relay){
  execFileSync("i2cset", ["-y", String(bus), String(addr), String(relay), "0x00"]);
}

/* --------------------------------------------------
   Hardware abstractie
-------------------------------------------------- */

function makeHw(hw){
  const mode = String(hw.mode || "sim").toLowerCase();

  if (mode === "i2c"){
    const bus = hw.i2cBus || 1;
    const addr = hw.i2cAddress || "0x10";

    return {
      openOn(){ i2cOn(bus, addr, hw.openRelay); },
      closeOn(){ i2cOn(bus, addr, hw.closeRelay); },
      allOff(){
        i2cOff(bus, addr, hw.openRelay);
        i2cOff(bus, addr, hw.closeRelay);
      },
      light(on){
        on ? i2cOn(bus, addr, hw.lightRelay)
           : i2cOff(bus, addr, hw.lightRelay);
      }
    };
  }

  return {
    openOn(){},
    closeOn(){},
    allOff(){},
    light(){}
  };
}

/* --------------------------------------------------
   Main
-------------------------------------------------- */

async function main(){
  const cfg = readCfg();
  const hw = makeHw(cfg.hardware);

  const api = cfg.apiBaseUrl;
  const boxId = cfg.boxId;

  const urlBox = `${api}/api/boxes/${encodeURIComponent(boxId)}`;
  const urlStatus = `${api}/api/status/${encodeURIComponent(boxId)}`;

  let door = "closed";
  let motion = "";
  let since = Date.now();
  let activeMotion = false;

  async function sendStatus(source){
    await httpPost(urlStatus, {
      ts: nowIso(),
      boxId,
      source,
      state: { door, motion, since },
      device: {
        deviceId: cfg.device.deviceId,
        sdTag: cfg.device.sdTag,
        agentName: cfg.device.agentName,
        hardwareProfile: cfg.device.hardwareProfile,
        hostname: os.hostname(),
        version: AGENT_VERSION
      }
    });
  }

  async function runMotion(type){
    activeMotion = true;

    hw.light(true);
    type === "open" ? hw.openOn() : hw.closeOn();

    const total = type === "open" ? cfg.openDurationMs : cfg.closeDurationMs;
    let elapsed = 0;

    while (elapsed < total){
      await sleep(100);
      elapsed += 100;
    }

    hw.allOff();
    activeMotion = false;
  }

  console.log("[AGENT] gestart", { boxId, version: AGENT_VERSION });
  await sendStatus("boot");
  setInterval(() => sendStatus("heartbeat"), cfg.heartbeatMs);

  while (true){
    await sleep(cfg.pollMs);

    if (activeMotion) continue;

    const r = await httpGet(urlBox);
    if (!r.ok) continue;

    const desired = r.json?.box?.desired;
    if (!desired) continue;

    if (desired === "open" && door !== "open"){
      motion = "opening"; since = Date.now();
      await sendStatus("open-start");
      await runMotion("open");
      door = "open"; motion = ""; since = Date.now();
      await sendStatus("open-done");
    }

    if (desired === "close" && door !== "closed"){
      motion = "closing"; since = Date.now();
      await sendStatus("close-start");
      await runMotion("close");
      door = "closed"; motion = ""; since = Date.now();
      await sleep(cfg.lightAfterCloseMs);
      hw.light(false);
      await sendStatus("close-done");
    }
  }
}

main().catch(e => {
  console.error("[AGENT] FATAAL", e);
  process.exit(1);
});
