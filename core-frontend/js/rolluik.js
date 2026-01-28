/**
 * Zet de visuele staat van het rolluik in de UI.
 *
 * Mogelijke states:
 * - "open"
 * - "opening"
 * - "closing"
 * - "closed"
 * - null / undefined
 */
function setRolluikState(state) {
  const rolluik = document.querySelector(".gb-rolluik");
  const label = document.querySelector(".gb-rolluik-label");

  if (!rolluik) return;

  // Normaliseer input
  const s = (state || "").toString().toLowerCase();

  // Reset alle rolluik-states
  rolluik.classList.remove(
    "is-open",
    "is-opening",
    "is-closing"
  );

  let labelText;

  switch (s) {
    case "open":
      rolluik.classList.add("is-open");
      labelText = "Open";
      break;

    case "opening":
      rolluik.classList.add("is-opening");
      labelText = "Bezig met openen";
      break;

    case "closing":
      rolluik.classList.add("is-closing");
      labelText = "Bezig met sluiten";
      break;

    case "closed":
    case "":
    default:
      // Gesloten = geen extra class nodig
      labelText = "Gesloten";
      break;
  }

  if (label) {
    label.textContent = labelText;
  }
}
