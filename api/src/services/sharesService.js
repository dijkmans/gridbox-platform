// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare as dbFindActiveShare,
  findActiveShareByPhone as dbFindActiveShareByPhone,
} from "../db.js";

const runningOnCloudRun = !!process.env.K_SERVICE;

let localShares = [];

export async function createShare(share) {
  if (!runningOnCloudRun) {
    const mock = {
      id: `mock-${localShares.length + 1}`,
      boxId: share.boxId,
      phone: share.phone,
      active: true,
      createdAt: new Date().toISOString(),
    };
    localShares.push(mock);
    return mock;
  }

  return await dbCreateShare(share);
}

export async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter((s) => s.boxId === boxId && s.active === true);
  }
  return await dbListSharesForBox(boxId);
}

export async function findActiveShare(boxId, phone) {
  if (!runningOnCloudRun) {
    return (
      localShares.find((s) => s.boxId === boxId && s.phone === phone && s.active === true) ||
      null
    );
  }
  return await dbFindActiveShare(boxId, phone);
}

export async function findActiveShareByPhone(phone) {
  if (!runningOnCloudRun) {
    return localShares.find((s) => s.phone === phone && s.active === true) || null;
  }

  // Cruciaal: dit moet NIET via findActiveShare(null, phone)
  return await dbFindActiveShareByPhone(phone);
}

export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
