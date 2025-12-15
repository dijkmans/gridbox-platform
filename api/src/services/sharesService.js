// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare as dbFindActiveShare
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock data (alleen voor lokaal draaien)
let localShares = [];

// ---------------------------------------------------------
// Nieuwe share aanmaken
// ---------------------------------------------------------
export async function createShare(share) {
  if (!runningOnCloudRun) {
    const mock = {
      id: `mock-${localShares.length + 1}`,
      ...share,
      status: "active",
      createdAt: new Date().toISOString()
    };

    localShares.push(mock);
    return mock;
  }

  return await dbCreateShare(share);
}

// ---------------------------------------------------------
// Alle shares voor een box
// ---------------------------------------------------------
export async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter((s) => s.boxId === boxId);
  }

  return await dbListSharesForBox(boxId);
}

// ---------------------------------------------------------
// Actieve share zoeken op box + telefoonnummer
// ---------------------------------------------------------
export async function findActiveShare(boxId, phone) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          s.phone === phone &&
          s.status === "active"
      ) || null
    );
  }

  return await dbFindActiveShare(boxId, phone);
}

// ---------------------------------------------------------
// Actieve share zoeken op enkel telefoonnummer
// (gebruikt door SMS-webhook)
// ---------------------------------------------------------
export async function findActiveShareByPhone(phone) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        (s) => s.phone === phone && s.status === "active"
      ) || null
    );
  }

  return await dbFindActiveShare(null, phone);
}

// ---------------------------------------------------------
// Code generator (6 cijfers)
// ---------------------------------------------------------
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
