// raspberry-pi/agent/src/apiClient.js

export function createApiClient({ apiBaseUrl, boxId }) {
  const baseStatusUrl = `${apiBaseUrl}/api/status/${boxId}`;

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST ${url} ${res.status} ${text}`);
    }

    return res.json().catch(() => ({}));
  }

  async function getJson(url) {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GET ${url} ${res.status} ${text}`);
    }

    return res.json();
  }

  return {
    // -------------------------------------------------
    // Status / heartbeat
    // -------------------------------------------------

    async sendStatus(payload) {
      return postJson(baseStatusUrl, payload);
    },

    // -------------------------------------------------
    // Events (voor later)
    // -------------------------------------------------

    async sendEvent(payload) {
      return postJson(`${apiBaseUrl}/api/events/${boxId}`, payload);
    },

    // -------------------------------------------------
    // Commands (voor later)
    // -------------------------------------------------

    async fetchNextCommand() {
      const data = await getJson(`${apiBaseUrl}/api/commands/${boxId}/next`);
      if (!data || !data.command) return null;
      return data.command;
    },

    async ackCommand(commandId, ok, errorCode, errorMessage) {
      return postJson(
        `${apiBaseUrl}/api/commands/${boxId}/${commandId}/result`,
        {
          ok,
          errorCode,
          errorMessage
        }
      );
    }
  };
}
