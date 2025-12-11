// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare as dbFindActiveShare
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock data
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
export async function findActiveShare(boxId, phoneNumber) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        (s) =>
          s.boxId === boxId &&
          s.phoneNumber === phoneNumber &&
          s.status === "active"
      ) || null
    );
  }

  return await dbFindActiveShare(boxId, phoneNumber);
}

// ---------------------------------------------------------
// Actieve share zoeken op enkel telefoonnummer
// (handig voor SMS-webhook)
// ---------------------------------------------------------
export async function findActiveShareByPhone(phoneNumber) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        (s) => s.phoneNumber === phoneNumber && s.status === "active"
      ) || null
    );
  }

  return await dbFindActiveShare(null, phoneNumber);
}

// ---------------------------------------------------------
// Code generator (6 cijfers)
// ---------------------------------------------------------
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
