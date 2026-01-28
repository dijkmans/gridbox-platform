function setRolluikState(state) {
  const r = document.querySelector('.gb-rolluik');
  const label = document.querySelector('.gb-rolluik-label');
  if (!r) return;

  // reset alles
  r.classList.remove('is-open', 'is-opening', 'is-closing');

  switch (state) {
    case 'open':
      r.classList.add('is-open');
      if (label) label.textContent = 'Open';
      break;

    case 'opening':
      r.classList.add('is-opening');
      if (label) label.textContent = 'Bezig met openen';
      break;

    case 'closing':
      r.classList.add('is-closing');
      if (label) label.textContent = 'Bezig met sluiten';
      break;

    case 'closed':
    default:
      if (label) label.textContent = 'Gesloten';
      break;
  }
}
