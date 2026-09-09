// Display formatting. Nothing here changes state or logic: it only turns the
// stored shapes (ISO dates, 24-hour slots, urgency enums) into the words a
// health worker would actually say out loud.

import { isoDate } from "./seed";
import type { Member, Urgency } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Today" / "Tomorrow" / "Fri 11 Sep" — never a bare ISO string. */
export function dayLabel(iso: string): string {
  if (iso === isoDate(0)) return "Today";
  if (iso === isoDate(1)) return "Tomorrow";
  if (iso === isoDate(-1)) return "Yesterday";
  return shortDate(iso);
}

/** The calendar form, always: "Wed 9 Sep". */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()].slice(0, 3)} ${d} ${MONTHS[m - 1]}`;
}

/** The full date under a screen title: "Wednesday, 9 Sep". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}`;
}

function hour12(hhmm: string): { h: number; min: string; pm: boolean } {
  const [h, min] = hhmm.split(":").map(Number);
  return { h: h % 12 === 0 ? 12 : h % 12, min: String(min).padStart(2, "0"), pm: h >= 12 };
}

/** "09:00–10:00" reads as "9–10 am"; ":30" keeps its minutes. */
export function slotLabel(slot: string): string {
  const [from, to] = slot.split("–");
  if (!from || !to) return slot;
  const a = hour12(from);
  const b = hour12(to);
  const show = (t: typeof a) => (t.min === "00" ? `${t.h}` : `${t.h}:${t.min}`);
  const suffix = (t: typeof a) => (t.pm ? "pm" : "am");
  return a.pm === b.pm
    ? `${show(a)}–${show(b)} ${suffix(b)}`
    : `${show(a)} ${suffix(a)}–${show(b)} ${suffix(b)}`;
}

/** The word a person reads. The enum stays in the data, never on screen. */
export const URGENCY_LABEL: Record<Urgency | "done", string> = {
  red: "Urgent",
  amber: "Needs a visit",
  green: "Home care",
  done: "Seen",
};

/** "3 years · child" rather than a comma-joined field dump. */
export function memberLine(m: Member): string {
  return `${m.age} ${m.age === 1 ? "year" : "years"} · ${m.role}`;
}
