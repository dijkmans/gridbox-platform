// raspberry-pi/agent/src/apiClient.js

export function createApiClient({ apiBaseUrl, orgId, boxId }) {
  const base = `${apiBaseUrl}/api/orgs/${orgId}/boxes/${boxId}`;

  async function post(path, body) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`POST ${path} ${res.status} ${t}`);
    }
    return res.json().catch(() => ({}));
  }

  async function get(path) {
    const res = await fetch(`${base}${path}`);
    if (res.status === 204) return null;
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`GET ${path} ${res.status} ${t}`);
    }
    return res.json();
  }

  return {
    async sendStatus(payload) {
      await post("/status", payload);
    },

    async sendEvent(payload) {
      await post("/events", payload);
    },

    async fetchNextCommand() {
      const data = await get("/commands/next");
      if (!data || !data.command) return null;
      return data.command;
    },

    async ackCommand(commandId, ok, errorCode, errorMessage) {
      await post(`/commands/${commandId}/result`, {
        ok,
        errorCode,
        errorMessage
      });
    }
  };
}
