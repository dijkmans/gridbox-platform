// api/src/scripts/clone_box.js
import { Firestore } from "@google-cloud/firestore";

const args = process.argv;
const sourceBoxId = args[2];
const targetBoxId = args[3];

if (!sourceBoxId || !targetBoxId) {
  console.error("Gebruik: node clone_box.js <bronBoxId> <doelBoxId>");
  process.exit(1);
}

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "gridbox-platform"
});

async function cloneBox() {
  const sourceRef = db.collection("boxes").doc(sourceBoxId);
  const targetRef = db.collection("boxes").doc(targetBoxId);

  const sourceSnap = await sourceRef.get();

  if (!sourceSnap.exists) {
    throw new Error("Bron box bestaat niet: " + sourceBoxId);
  }

  const sourceData = sourceSnap.data();

  await targetRef.set(sourceData);

  console.log(
    "OK: " +
    targetBoxId +
    " is een kopie van " +
    sourceBoxId
  );
}

cloneBox()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
