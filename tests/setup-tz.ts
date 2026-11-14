// Alle Zeit-Tests laufen in deutscher Zeit, damit Sommerzeit-Fälle reproduzierbar sind.
export default function setup() {
  process.env.TZ = 'Europe/Berlin';
}
