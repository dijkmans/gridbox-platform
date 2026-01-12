// ============================================
// API.JS
// Centrale laag voor backend calls
// ============================================

import { API_BASE, getToken, logout } from "./auth.js";
import { demoData } from "./demoData.js";

// DEMO MODE UIT
const USE_DEMO = false;

// =====================================================
// 1. Interne request helper
// =====================================================
async function request(path, options = {}) {
  const token = getToken();

  if (USE_DEMO) {
    return demoResponse(path, options);
  }

  const headers = options.headers || {};
  headers["Authorization"] = "Bearer " + token;
  headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(API_BASE + path, { ...options, headers });

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "API fout");
    }

    return res.json();
  } catch (err) {
    console.error("API fout:", err);
    throw err;
  }
}

// =====================================================
// 2. Beschikbare API functies
// =====================================================
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

  // ✅ DIT IS DE FIX
  addShare(boxId, body) {
    return fetch(`${API_BASE}/shares`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      },
      body: JSON.stringify({
        phone: body.phone,
        boxNumber: Number(boxId.split("-").pop()) || 1,
        boxId: boxId,
        expiresAt: null
      })
    }).then(res => {
      if (!res.ok) {
        return res.text().then(t => {
          throw new Error(t || "Share API fout");
        });
      }
      return res.json();
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

// =====================================================
// 3. DEMO MODE (ongewijzigd, maar UIT)
// =====================================================

function demoResponse(path, options = {}) {
  if (path === "/boxes") {
    return demoData.groups;
  }

  const matchShares = path.match(/\/boxes\/(.+)\/shares/);
  if (matchShares) {
    const boxId = matchShares[1];
    const box = findDemoBox(boxId);

    if (!box) return [];

    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      box.shares.push({
        time: new Date().toLocaleTimeString("nl-BE"),
        phone: body.phone,
        comment: body.comment,
        status: body.authorized ? "authorized" : "pending"
      });
    }

    return box.shares;
  }

  return [];
}

function findDemoBox(id) {
  for (const g of demoData.groups) {
    for (const b of g.boxes) {
      if (b.id === id) return b;
    }
  }
  return null;
}
