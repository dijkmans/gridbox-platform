import admin from "firebase-admin";

let db = null;

if (!admin.apps.length) {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountBase64) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT ontbreekt in environment variables");
    throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
  }

  const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountBase64, "base64").toString()
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase Admin initialized");
}

db = admin.firestore();

export { db };
