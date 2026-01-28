function setRolluikState(state) {
  const r = document.querySelector('.gb-rolluik');
  const label = document.querySelector('.gb-rolluik-label');

  if (!r) return;

  if (state === 'open') {
    r.classList.add('open');
    if (label) label.textContent = 'Open';
  } else {
    r.classList.remove('open');
    if (label) label.textContent = 'Gesloten';
  }
}