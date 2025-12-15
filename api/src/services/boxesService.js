// api/src/services/boxesService.js
import fetch from "node-fetch";

export async function openBox(boxId) {
  try {
    const res = await fetch(
      `https://gridbox-api-960191535038.europe-west1.run.app/api/devices/${boxId}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" })
      }
    );

    if (!res.ok) {
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ openBox error:", err);
    return { success: false };
  }
}
