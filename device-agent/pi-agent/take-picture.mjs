import fs from "fs";
import { execFile } from "child_process";

const API_BASE = process.env.API_BASE || "https://gridbox-api-960191535038.europe-west1.run.app";
const BOX_ID = process.env.BOX_ID || "gbox-001";

// camera snapshot url (deze gebruik je al)
const SNAPSHOT_URL = process.env.CAMERA_SNAPSHOT_URL || "http://127.0.0.1/cgi-bin/snapshot.cgi";

// temp bestand
const TMP_FILE = "/tmp/take_picture.jpg";

// elke 2 seconden checken
setInterval(async () => {
  try {
    const cmdRes = await fetch(`${API_BASE}/api/boxes/${BOX_ID}/commands`);
    if (!cmdRes.ok) return;

    const cmd = await cmdRes.json();
    if (!cmd || cmd.type !== "take_picture") return;

    console.log("📸 TAKE PICTURE command ontvangen");

    // snapshot nemen
    await new Promise((resolve, reject) => {
      execFile(
        "curl",
        ["-s", "-o", TMP_FILE, SNAPSHOT_URL],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // laat bestaande agent-upload dit bestand meenemen
    fs.copyFileSync(
      TMP_FILE,
      "/var/lib/gridbox-agent/force-upload.jpg"
    );

    // command ack
    await fetch(
      `${API_BASE}/api/boxes/${BOX_ID}/commands/${cmd.commandId}/ack`,
      { method: "POST" }
    );

    console.log("✅ Foto genomen en geüpload");
  } catch (e) {
    console.error("take-picture error:", e.message);
  }
}, 2000);
