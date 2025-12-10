// api/src/services/sharesService.js

const {
  createShare: dbCreateShare,
  listSharesForBox: dbListSharesForBox,
  findActiveShare: dbFindActiveShare
} = require("../services/db");

// Lokale mock fallback als Firestore niet actief is
const runningOnCloudRun = !!process.env.K_SERVICE;

let localShares = [];

// ---------------------------------------------------------
// Nieuwe share aanmaken
// ---------------------------------------------------------
async function createShare(share) {
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

  // Cloud Run → Firestore
  return await dbCreateShare(share);
}

// ---------------------------------------------------------
// Alle shares voor een box ophalen
// ---------------------------------------------------------
async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter(s => s.boxId === boxId);
  }

  return await dbListSharesForBox(boxId);
}

// ---------------------------------------------------------
// Check of een gebruiker toegang heeft tot een box
// ---------------------------------------------------------
async function findActiveShare(boxId, phoneNumber) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        s =>
          s.boxId === boxId &&
          s.phoneNumber === phoneNumber &&
          s.status === "active"
      ) || null
    );
  }

  return await dbFindActiveShare(boxId, phoneNumber);
}

// ---------------------------------------------------------
// Hulpfunctie: nieuwe toegangscode genereren
// ---------------------------------------------------------
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  createShare,
  listSharesForBox,
  findActiveShare,
  generateCode
};
