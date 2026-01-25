// api/src/firebase.js
import admin from "firebase-admin";

/**
 * Zorg dat Firebase Admin exact één keer initialiseert.
 * In Cloud Run blijft de container soms warm.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    // Project en credentials worden automatisch
    // opgehaald via Cloud Run service account
  });
}

/**
 * Firestore Admin instance
 * Dit is de enige db die gebruikt mag worden in de backend
 */
const db = admin.firestore();

/**
 * Optioneel maar sterk aanbevolen:
 * zet consistente instellingen
 */
db.settings({
  ignoreUndefinedProperties: true
});

export { db };
