// ============================================
// API.JS
// Centrale laag voor backend calls + DEMO MODE
// ============================================

import { API_BASE, getToken, logout } from "./auth.js";
import { demoData } from "./demoData.js";

// DEMO MODE aan/uit
const USE_DEMO = true;

// =====================================================
// 1. Interne request helper
// =====================================================
async function request(path, options = {}) {
  const token = getToken();

  // DEMO MODE: nooit echt fetchen
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

    if (!res.ok) throw new Error("API fout");

    return res.json();
  } catch (err) {
    console.warn("API niet bereikbaar. DEMO MODE actief.");
    return demoResponse(path, options);
  }
}

// =====================================================
// 2. Beschikbare API functies (blijven identiek)
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

// =====================================================
// 3. DEMO MODE DATAFILTER
// =====================================================

function demoResponse(path, options = {}) {
  // 1. Alle boxen (groepen) ophalen
  if (path === "/boxes") {
    return demoData.groups;
  }

  // 2. Shares: /boxes/:id/shares
  const matchShares = path.match(/\/boxes\/(.+)\/shares/);
  if (matchShares) {
    const boxId = matchShares[1];
    const box = findDemoBox(boxId);

    if (!box) return [];

    if (options.method === "POST") {
      // Share toevoegen in demo-mode
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

  // 3. Events: /boxes/:id/events
  const matchEvents = path.match(/\/boxes\/(.+)\/events/);
  if (matchEvents) {
    const boxId = matchEvents[1];
    const box = findDemoBox(boxId);
    return box ? box.events : [];
  }

  // 4. Pictures: /boxes/:id/pictures
  const matchPics = path.match(/\/boxes\/(.+)\/pictures/);
  if (matchPics) {
    const boxId = matchPics[1];
    const box = findDemoBox(boxId);
    return box ? box.pictures : [];
  }

  // 5. Planner
  const matchPlanner = path.match(/\/planner\/(.+)/);
  if (matchPlanner) {
    const group = matchPlanner[1];
    return demoPlanning[group] || [];
  }

  if (path === "/planner" && options.method === "POST") {
    const body = JSON.parse(options.body);
    const g = body.group || "Overig";

    if (!demoPlanning[g]) demoPlanning[g] = [];

    demoPlanning[g].push({
      date: body.date,
      phone: body.phone,
      box: body.box,
      comment: body.comment,
      status: "nieuw"
    });

    return { ok: true };
  }

  console.warn("DEMO MODE: onbekend endpoint:", path);
  return [];
}

// Extra demo planning container
const demoPlanning = {};

// Zoekbox in demo dataset
function findDemoBox(id) {
  for (const g of demoData.groups) {
    for (const b of g.boxes) {
      if (b.id === id) return b;
    }
  }
  return null;
}
