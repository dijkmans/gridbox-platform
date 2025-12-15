const API_BASE = "http://localhost:8080/api"; 
// later: https://jouw-api-url.run.app/api

export async function fetchCommands(boxId) {
  const res = await fetch(`${API_BASE}/commands/${boxId}`);
  const data = await res.json();
  if (!data.ok) return [];
  return data.commands || [];
}

export async function ackCommand(boxId, commandId, result = "ok") {
  await fetch(`${API_BASE}/commands/${boxId}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId, result })
  });
}

export async function sendStatus(boxId, status) {
  await fetch(`${API_BASE}/status/${boxId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status)
  });
}
