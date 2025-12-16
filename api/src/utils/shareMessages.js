/**
 * Genereert de standaard SMS-tekst
 * bij het delen van een Gridbox
 */
export function buildShareSms({ boxNumber }) {
  return (
    `Gridbox ${boxNumber} is met u gedeeld. ` +
    `Antwoord met OPEN ${boxNumber} om de Gridbox te openen.`
  );
}
