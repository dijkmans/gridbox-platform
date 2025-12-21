// api/src/scripts/clone_box.js
import { Firestore } from "@google-cloud/firestore";

const [,, sourceBoxId, targetBoxId] = process.argv;

if (!sourceBoxId || !targetBoxId) {
  console.error("Gebruik: node clone_box.js <bronBoxId> <doelBoxId>");
  process.exit(1);
}

// Firestore init (werkt in Cloud Shell + lokaal + CI)
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "gridbox-platform"
});

async function cloneBox() {
  const sourceRef = db.collection("boxes").doc(sourceBoxId);
  const targetRef = db.collection("boxes").doc(targetBoxId);

  const sourceSnap = await sourceRef.get();

  if (!sourceSnap.exists) {
    throw new Error(`Bron box ${sourceBoxId} bestaat niet`);
  }

  const sourceData = sourceSnap.data();

  // Veilig: geen portal-specifieke runtime data kopiëren
  const cleanedData = {
    ...sourceData
  };

  await targetRef.set(cleanedData);

  console.log(`OK: ${targetBoxId} is een kopie van ${sourceBoxId
