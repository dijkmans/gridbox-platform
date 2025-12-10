// api/src/data/mockData.js

// ----------------------------------------------
// MOCK BOXES
// ----------------------------------------------
const boxes = [
  {
    id: "1",
    location: "Winkelomheide 233",
    status: "closed",
    lastOpened: null,
  },
  {
    id: "2",
    location: "Mol – Turnhoutsebaan 8",
    status: "closed",
    lastOpened: null,
  },
  {
    id: "3",
    location: "Herselt – Servicepunt",
    status: "closed",
    lastOpened: null,
  }
];

// ----------------------------------------------
// MOCK SHARES
// ----------------------------------------------
const shares = [
  {
    id: "s1",
    boxId: "1",
    phoneNumber: "+32470000000",
    code: "123456",
    valid: true,
  }
];

// ----------------------------------------------
// Exporteren
// ----------------------------------------------
module.exports = {
  boxes,
  shares,
};
