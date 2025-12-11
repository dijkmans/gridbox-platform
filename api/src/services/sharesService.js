// api/src/services/sharesService.js

const {
  createShare: dbCreateShare,
  listSharesForBox: dbListSharesForBox,
  findActiveShare: dbFindActiveShare
} = require("../db");

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

  return await dbCreateShare(share);
}

// ---------------------------------------------------------
// Alle shares voor een box
// ---------------------------------------------------------
async function listSharesForBox(boxId) {
  if (!runningOnCloudRun) {
    return localShares.filter((s) => s.boxId === boxId);
  }

  return await dbListSharesForBox(boxId);
}

// ---------------------------------------------------------
// Actieve share zoeken op box + telefoonnummer
// ---------------------------------------------------------
async function findActiveShare(boxId, phoneNumber) {
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
// Actieve share zoeken op telefoonnummer (voor SMS-webhook)
// ---------------------------------------------------------
async function findActiveShareByPhone(phoneNumber) {
  if (!runningOnCloudRun) {
    return (
      localShares.find(
        (s) => s.phoneNumber === phoneNumber && s.status === "active"
      ) || null
    );
  }

  // Firestore-variant kan je later verfijnen
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
