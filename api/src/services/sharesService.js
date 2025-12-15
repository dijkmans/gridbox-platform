// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShareByPhone as dbFindActiveShareByPhone
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock data
let localShares = [];

// -------------------------------------
// Nieuwe share
// -------------------------------------
export async function createShare(share) {
  if (!runningOnCloudRun) {
    const mock = {
      id: `mock-${localShares.length + 1}`,
      ...share,
      active: true,
      createdAt: new Date().toISOString()
    };
    localShares.push(mock);
    return mock;
  }

  return await dbCreateShare(share);
}

// -------------------------------------
// Shares voor box
// -------------------------------------
export async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter(
      s => s.boxId === boxId && s.active === true
    );
  }

  return await dbListSharesForBox(boxId);
}

// -------------------------------------
// Actieve share op telefoonnummer (SMS)
// -------------------------------------
export async function findActiveShareByPhone(phone) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        s => s.phone === phone && s.active === true
      ) || null
    );
  }

  return await dbFindActiveShareByPhone(phone);
}
