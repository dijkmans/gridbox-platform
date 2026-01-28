// ============================================
// API.JS - Gridbox Platform (Productie Versie)
// Centrale laag voor backend communicatie
// ============================================

import { API_BASE, getToken, logout } from "./auth.js";

/**
 * 1. Centrale request helper
 * Regelt authenticatie en foutafhandeling voor alle calls.
 */
async function request(path, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  
  headers["Authorization"] = "Bearer " + token;
  headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(API_BASE + path, { ...options, headers });

    // Bij een ver verlopen sessie automatisch uitloggen
    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "API fout");
    }

    return res.json();
  } catch (err) {
    console.error("Netwerk- of API-fout:", err);
    throw err;
  }
}

/**
 * 2. Beschikbare API functies
 * Hier staan alle acties die het dashboard kan uitvoeren.
 */
export const api = {
  // Haalt alle Gridboxen op voor de ingelogde gebruiker
  getBoxes() {
    return request("/boxes");
  },

  // Stuurt de Open/Dicht opdracht naar de Cloud
  toggleBox(boxId) {
    return request(`/boxes/${boxId}/toggle`, { method: "POST" });
  },

  // Haalt de lijst met gedeelde toegangen op
  getShares(boxId) {
    return request(`/boxes/${boxId}/shares`);
  },

  // Voegt een nieuwe share toe (nu via de centrale request helper)
  addShare(boxId, body) {
    return request("/shares", {
      method: "POST",
      body: JSON.stringify({
        phone: body.phone,
        boxNumber: Number(boxId.split("-").pop()) || 1,
        boxId: boxId,
        expiresAt: null
      })
    });
  },

  // Haalt de geschiedenis van de box op
  getEvents(boxId) {
    return request(`/boxes/${boxId}/events`);
  },

  // Haalt gemaakte foto's op van de Gridbox camera
  getPictures(boxId) {
    return request(`/boxes/${boxId}/pictures`);
  },

  // Haalt de planning op voor een specifieke groep/locatie
  getPlanning(group) {
    return request(`/planner/${group}`);
  },

  // Voegt een item toe aan de planner
  addPlanning(body) {
    return request("/planner", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
};
