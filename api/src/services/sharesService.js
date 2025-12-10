// api/src/services/sharesService.js

const {
  createShare: dbCreateShare,
  listSharesForBox: dbListSharesForBox,
  findActiveShare: dbFindActiveShare
} = require("./db"); // fix: correcte pad

// Check of Firestore actief moet zijn
const runningOnCloudRun = !!process.env.K_SERVICE;

// Lokale mock data wanneer Firestore niet draait
let localShares = [];

// ---------------------------------------------------------
// Share aanmaken
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

  return await dbCreateShare(share);
}

// ---------------------------------------------------------
// Shares ophalen voor een box
// ---------------------------------------------------------
async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter(s => s.boxId === boxId);
  }

  return await dbListSharesForBox(boxId);
}

// ---------------------------------------------------------
// Share zoeken op telefoonnummer + box
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
// Share zoeken puur op telefoonnummer (nodig voor SMS-webhook)
// ---------------------------------------------------------
async function findActiveShareByPhone(phoneNumber) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        s => s.phoneNumber === phoneNumber && s.status === "active"
      ) || null
    );
  }

  // Firestore variant moet je later implementeren
  return await dbFindActiveShare(null, phoneNumber);
}

// ---------------------------------------------------------
// Code generator
// ---------------------------------------------------------
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  createShare,
  listSharesForBox,
  findActiveShare,
  findActiveShareByPhone,
  generateCode
};
