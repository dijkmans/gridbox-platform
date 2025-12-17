// raspberry-pi/agent/src/apiClient.js

export function createApiClient({ apiBaseUrl, boxId }) {
  const base = `${apiBaseUrl}/api`;

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
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`GET ${path} ${res.status} ${t}`);
    }
    return res.json();
  }

  return {
    async sendStatus(payload) {
      await post(`/status/${boxId}`, payload);
    },

    async getStatus() {
      return get(`/status/${boxId}`);
    }
  };
}
