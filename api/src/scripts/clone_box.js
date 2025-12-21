// api/src/scripts/clone_box.js
import { db } from "../db.js";

async function main() {
  const fromId = process.argv[2];
  const toId = process.argv[3];

  if (!fromId || !toId) {
    console.error("Gebruik: node api/src/scripts/clone_box.js gbox-001 gbox-003");
    process.exit(1);
  }

  const fromRef = db.collection("boxes").doc(fromId);
  const toRef = db.collection("boxes").doc(toId);

  const snap = await fromRef.get();
  if (!snap.exists) {
    throw new Error(`Bron bestaat niet: ${fromId}`);
  }

  const data = snap.data() || {};

  // veiligheidscheck: niet per ongeluk dezelfde id overschrijven
  if (fromId === toId) {
    throw new Error("Van en naar zijn hetzelfde. Stop.");
  }

  // schrijf alles naar de nieuwe box (overschrijft het document als het al bestaat)
  await toRef.set(data);

  console.log(`OK: ${toId} is een kopie van ${fromId}`);
  process.exit(0);
}

main().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
