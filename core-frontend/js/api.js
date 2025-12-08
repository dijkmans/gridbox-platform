// ============================================
// API.JS
// Centrale laag voor alle backend calls
// ============================================

import { API_BASE, getToken, logout } from "./auth.js";

// Algemene request helper
async function request(path, options = {}) {
  const token = getToken();
  if (!token) return logout();

  const headers = options.headers || {};
  headers["Authorization"] = "Bearer " + token;
  headers["Content-Type"] = "application/json";

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    logout();
    return;
  }

  return res.json();
}

// --------------------------------------------
// Beschikbare API functies
// --------------------------------------------
export const api = {
  // Alle boxen ophalen (groepen + boxen)
  getBoxes() {
    return request("/boxes");
  },

  // Open/dicht doen
  toggleBox(boxId) {
    return request(`/boxes/${boxId}/toggle`, { method: "POST" });
  },

  // Shares ophalen van een box
  getShares(boxId) {
    return request(`/boxes/${boxId}/shares`);
  },

  // Share aanmaken
  addShare(boxId, body) {
    return request(`/boxes/${boxId}/shares`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  // Events ophalen
  getEvents(boxId) {
    return request(`/boxes/${boxId}/events`);
  },

  // Camerabeelden
  getPictures(boxId) {
    return request(`/boxes/${boxId}/pictures`);
  },

  // Planning ophalen
  getPlanning(group) {
    return request(`/planner/${group}`);
  },

  // Planning toevoegen
  addPlanning(body) {
    return request("/planner", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
};
