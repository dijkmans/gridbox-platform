// api/src/services/sharesService.js

import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare,
  findActiveShareByPhone
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

// lokale mock (alleen lokaal)
let localShares = [];

// share aanmaken
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

// shares per box
export async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter(
      (s) => s.boxId === boxId && s.active === true
    );
  }

  return dbListSharesForBox(boxId);
}

// actieve share voor box + phone
export async function findActiveShareForBox(boxId, phone) {
  return findActiveShare(boxId, phone);
}

// ✅ DIT MOET BESTAAN
export async function findActiveShareByPhone(phone) {
  return findActiveShareByPhone(phone);
}
