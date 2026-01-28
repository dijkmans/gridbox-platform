/**
 * Zet de visuele staat van het rolluik
 * Verwachte states:
 * - "open"
 * - "opening"
 * - "closing"
 * - "closed" (of null / undefined)
 */
function setRolluikState(state) {
  const rolluik = document.querySelector(".gb-rolluik");
  const label = document.querySelector(".gb-rolluik-label");

  if (!rolluik) return;

  // alles resetten
  rolluik.classList.remove(
    "is-open",
    "is-opening",
    "is-closing"
  );

  let labelText = "Onbekend";

  switch (state) {
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
    default:
      // gesloten = geen class nodig
      labelText = "Gesloten";
      break;
  }

  if (label) {
    label.textContent = labelText;
  }
}
