/**
 * Formatteert een datum naar HH:MM
 */
function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Formatteert een datum naar DD/MM/YYYY
 */
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString("nl-BE");
}

/**
 * SMS bij het delen van een Gridbox
 */
export function buildShareSms({ boxNumber, expiresAt }) {
  const untilText = expiresAt
    ? ` tot en met ${formatDate(expiresAt)}`
    : "";

  return (
    `Gridbox ${boxNumber} is met u gedeeld${untilText}. ` +
    `Antwoord met OPEN ${boxNumber} om de Gridbox te openen.`
  );
}

/**
 * Waarschuwings-SMS
 * Wordt verstuurd 1 uur voor blokkering
 */
export function buildExpiryWarningSms({ boxNumber, blockedAt }) {
  return (
    `Let op: uw toegang tot Gridbox ${boxNumber} verloopt binnen 1 uur. ` +
    `U kan de Gridbox nog gebruiken tot ${formatTime(blockedAt)}.`
  );
}
