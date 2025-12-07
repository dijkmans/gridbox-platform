const { Firestore } = require("@google-cloud/firestore");

// In Cloud Run gebruikt dit automatisch de service account van het GCP-project
const firestore = new Firestore();

module.exports = { firestore };
