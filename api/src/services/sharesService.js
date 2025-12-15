// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare,
  findActiveShareByPhone
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock (alleen lokaal)
let localShares = [];

// ----------------------------------------------------
// Share aanmaken
// ----------------------------------------------------
export async function createShare(data) {
  if (!runningOnCloudRun) {
    const mock = {
      id: `mock-${localShares.length + 1}`,
      ...data,
      active: true,
      createdAt: new Date().toISOString()
    };
    localShares.push(mock);
    return mock;
  }

  return dbCreateShare(data);
}

// ----------------------------------------------------
// Shares per box
// ----------------------------------------------------
export async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter(
      (s) => s.boxId === boxId && s.active === true
    );
  }

  return dbListSharesForBox(boxId);
}

// ----------------------------------------------------
// Actieve share op box + phone
// ----------------------------------------------------
export async function findActiveShareForBox(boxId, phone) {
  return findActiveShare(boxId, phone);
}

// ----------------------------------------------------
// Actieve share op phone (SMS)
// ----------------------------------------------------
export async function findActiveShareByPhoneNumber(phone) {
  return findActiveShareByPhone(phone);
}
