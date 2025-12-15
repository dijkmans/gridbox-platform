// api/src/services/boxesService.js

import { getBox } from "../db.js";

// Cloud Run detectie
const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock boxen (alleen voor lokaal draaien)
const localBoxes = [
  {
    id: "heist-1",
    locationName: "Heist",
    number: 1,
    status: "online",
    description: "Mock Gridbox Heist #1",
    cameraEnabled: true
  },
  {
    id: "gbox-001",
    locationName: "Simulator",
    number: 1,
    status: "online",
    description: "Mock Gridbox 001",
    cameraEnabled: false
  }
];

// ---------------------------------------------------------
// Eén box ophalen
// ---------------------------------------------------------
export async function getById(boxId) {
  if (!runningOnCloudRun) {
    return localBoxes.find((b) => b.id === boxId) || null;
  }

  return await getBox(boxId);
}

// ---------------------------------------------------------
// Box openen (HOOFDFUNCTIE)
// ---------------------------------------------------------
export async function openBox(boxId) {
  console.log("🔓 openBox aangeroepen voor:", boxId);

  // 1. Box ophalen
  const box = await getById(boxId);

  if (!box) {
    console.warn("❌ Box niet gevonden:", boxId);
    return {
      success: false,
      message: `Box ${boxId} niet gevonden`
    };
  }

  // 2. Mock gedrag (lokaal of voorlopig)
  if (!runningOnCloudRun) {
    box.status = "open";
    box.lastOpened = new Date().toISOString();

    console.log("✅ Mock box geopend:", boxId);

    return {
      success: true,
      action: "open",
      box
    };
  }

  // 3. Cloud Run gedrag (nu nog mock, later IoT)
  console.log("🚀 Cloud Run: box openen gelogd voor", boxId);

  // TODO later:
  // - command document schrijven
  // - IoT publish
  // - relay triggeren

  return {
    success: true,
    action: "open",
    boxId
  };
}
