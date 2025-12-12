const API_BASE = "https://gridbox-api-960191535038.europe-west1.run.app/api";
const BOX_ID = "20";
const LOOP_INTERVAL_MS = 30000;

const executingCommands = new Set();

async function apiCall(method, url, body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json"
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return await response.json();
}

async function sendStatus() {
  const payload = {
    online: true,
    uptime: Math.floor(process.uptime()),
    temp: null
  };

  const res = await apiCall(
    "POST",
    `${API_BASE}/status/${BOX_ID}`,
    payload
  );

  console.log("[STATUS]", res.ok ? "ok" : "fout");
}

async function getCommands() {
  const res = await apiCall(
    "GET",
    `${API_BASE}/commands/${BOX_ID}`
  );

  if (!res.ok || !res.commands || res.commands.length === 0) {
    console.log("[COMMANDS] geen nieuwe commands");
    return [];
  }

  console.log(`[COMMANDS] ${res.commands.length} ontvangen`);
  return res.commands;
}

async function executeCommand(command) {
  if (executingCommands.has(command.id)) {
    console.log(`[SKIP] ${command.id} al bezig`);
    return;
  }

  executingCommands.add(command.id);

  try {
    console.log(`[EXECUTE] ${command.type} (${command.id})`);

    // fake uitvoering
    await new Promise(r => setTimeout(r, 1000));

    await apiCall(
      "POST",
      `${API_BASE}/commands/${BOX_ID}/ack`,
      {
        commandId: command.id,
        result: "ok"
      }
    );

    console.log(`[ACK] ${command.id}`);

    await apiCall(
      "POST",
      `${API_BASE}/events/${BOX_ID}`,
      {
        type: `${command.type}_OK`,
        source: "pi"
      }
    );

    console.log(`[EVENT] ${command.type}_OK`);

  } catch (err) {
    console.error(`[ERROR] command ${command.id}`, err.message);

  } finally {
    executingCommands.delete(command.id);
  }
}

async function loop() {
  try {
    console.log("---- loop ----");

    await sendStatus();

    const commands = await getCommands();
    for (const command of commands) {
      await executeCommand(command);
    }

  } catch (err) {
    console.error("[FATALE LOOP FOUT]", err.message);
  }
}

console.log("Gridbox Pi loop gestart");

setInterval(loop, LOOP_INTERVAL_MS);
loop();
