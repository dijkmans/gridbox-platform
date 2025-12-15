// api/src/services/firebase.js
import admin from "firebase-admin";

let app;

// ---------------------------------------------------------------------
// 🔐 Firebase service account laden via BASE64 environment variable
// ---------------------------------------------------------------------
if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      "❌ FIREBASE_SERVICE_ACCOUNT ontbreekt. Base64 JSON vereist."
    );
  }

  // Decode BASE64 naar JSON
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString()
  );

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Firestore referentie
const db = admin.firestore();

export { db };
