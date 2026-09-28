// Words for the sync chip, apart from the component so they can be tested.

/**
 * What is waiting, in the ASHA's units, not the store's: a booking is one
 * visit even though it saves a concern and a booking. "1 visit", "1 check",
 * "1 visit, 1 check".
 */
export function waitingWords(visits: number, checks: number): string {
  const part = (n: number, one: string) => (n === 0 ? "" : `${n} ${one}${n === 1 ? "" : "s"}`);
  return [part(visits, "visit"), part(checks, "check")].filter(Boolean).join(", ");
}
