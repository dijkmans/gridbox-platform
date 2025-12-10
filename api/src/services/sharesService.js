// api/src/services/sharesService.js

const {
  listSharesForBox,
  createShare,
  findActiveShare
} = require("../db");

// ---------------------------------------------------------
// De servicefunctie voor shares. Deze verwijst intern
// door naar de Firestore/db-layer of lokale mocks.
// ---------------------------------------------------------

module.exports = {
  createShare: async (data) => {
    return await createShare(data);
  },

  listSharesForBox: async (boxId) => {
    return await listSharesForBox(boxId);
  },

  findActiveShare: async (boxId, phoneNumber) => {
    return await findActiveShare(boxId, phoneNumber);
  }
};
