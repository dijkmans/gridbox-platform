// src/db.js
// Firestore client, gebruikt Application Default Credentials van Cloud Run

const { Firestore } = require("@google-cloud/firestore");

// In Cloud Run worden de credentials automatisch opgepikt.
// Lokaal zal Firestore mislukken als je geen `gcloud auth application-default login` gedaan hebt.
const firestore = new Firestore({
  projectId: "gridbox-platform"
});

module.exports = { firestore };
