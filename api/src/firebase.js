// api/src/firebase.js
import admin from "firebase-admin";

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function tryParseBase64Json(b64) {
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  // 1) Optie A: FIREBASE_SERVICE_ACCOUNT (string JSON)
  const sa1 = process.env.FIREBASE_SERVICE_ACCOUNT
    ? tryParseJson(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  // 2) Optie B: GOOGLE_APPLICATION_CREDENTIALS_BASE64 (base64 JSON)
  const sa2 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
    ? tryParseBase64Json(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64)
    : null;

  const serviceAccount = sa1 || sa2;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  // 3) Optie C: Default credentials (ADC). Dit werkt op Cloud Run met service account.
  admin.initializeApp();
}

initFirebaseAdmin();

export const db = admin.firestore();
export { admin };
