// api/src/services/sharesService.js
import {
  createShare as dbCreateShare,
  listSharesForBox as dbListSharesForBox,
  findActiveShare as dbFindActiveShare,
  findActiveShareByPhone as dbFindActiveShareByPhone,
} from "../db.js";

export async function createShare({ boxId, phone }) {
  return dbCreateShare({ boxId, phone });
}

export async function listSharesForBox(boxId) {
  return dbListSharesForBox(boxId);
}

export async function findActiveShare(boxId, phone) {
  return dbFindActiveShare(boxId, phone);
}

export async function findActiveShareByPhone(phone) {
  return dbFindActiveShareByPhone(phone);
}
