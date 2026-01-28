function setRolluikState(state) {
  const rolluik = document.querySelector(".gb-rolluik");
  const label = document.querySelector(".gb-rolluik-label");

  if (!rolluik) {
    console.warn("Rolluik element niet gevonden");
    return;
  }

  // alles resetten
  rolluik.classList.remove("is-open", "is-opening", "is-closing");

  let labelText = "Onbekend";

  switch (String(state).toLowerCase()) {
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
      // geen class nodig, default positie = gesloten
      labelText = "Gesloten";
      break;

    default:
      console.warn("Onbekende rolluik state:", state);
      labelText = "Onbekende status";
      break;
  }

  if (label) {
    label.textContent = labelText;
  }
}
