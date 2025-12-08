import { API_BASE, getToken, logout } from "./auth.js";

async function request(path, options = {}) {
  const token = getToken();
  if (!token) return logout();

  const headers = options.headers || {};
  headers["Authorization"] = "Bearer " + token;
  headers["Content-Type"] = "application/json";

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) return logout();
  return res.json();
}

export const api = {
  getBoxes() {
    return request("/boxes");
  },
  toggleBox(boxId) {
    return request(`/boxes/${boxId}/toggle`, { method: "POST" });
  },
  getShares(boxId) {
    return request(`/boxes/${boxId}/shares`);
  },
  addShare(boxId, body) {
    return request(`/boxes/${boxId}/shares`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  getEvents(boxId) {
    return request(`/boxes/${boxId}/events`);
  },
  getPictures(boxId) {
    return request(`/boxes/${boxId}/pictures`);
  },
  getPlanning(group) {
    return request(`/planner/${group}`);
  },
  addPlanning(body) {
    return request("/planner", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
};
