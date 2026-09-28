// What each person needs from the ASHA today, worked out once and read by
// both Today and the family picker. The person is the work item; the family
// is where she finds them. Display only: it reads the store and decides
// nothing about triage.

import { dayLabel, slotLabel } from "../../app/format";
import type { Booking, Concern, Family, Member, SyncStatus, Urgency } from "../../app/types";

export type Band = Urgency | "done";
export const BAND_ORDER: Record<Band, number> = { red: 0, amber: 1, green: 2, done: 3 };
export const BANDS: Band[] = ["red", "amber", "green", "done"];

/** What kind of thing is due, so the row can show a fitting icon. */
export type Kind = "visit" | "call" | "home" | "concern" | "done";

export type Row = {
  family: Family;
  /** The person the concern is about: the row is about them, not the head. */
  member?: Member;
  band: Band;
  kind: Kind;
  /** What she does, in a few words: "PHC visit", "Follow-up call". */
  task: string;
  /** Why, when the task alone does not say. */
  note?: string;
  /** When: "Tomorrow" and "9–10 am", or just "Today". */
  day?: string;
  time?: string;
  /** The ISO day it happens on; undated work (home care, a concern) is today's. */
  date: string;
  /** For sorting within a day: the slot, or "" for undated work. */
  slot: string;
  /** The concern this row is about: its reason, urgency and task all come from it. */
  concernId: string;
  /** Other open items for the same person, not shown on this row. */
  more: number;
  sync: SyncStatus;
};

/** A row for a day after today: planned work, not today's. */
export function isUpcoming(row: Row, today: string): boolean {
  return row.band !== "done" && row.date > today;
}

/**
 * Who needs her first, today: danger first, then calls already late, then
 * what is due today (calls and home follow-ups, then visits by time), then
 * open concerns with no date. Urgency orders within each step. Colour alone
 * never decides: a yellow call due today comes before a green concern.
 */
export function workRank(row: Row, today: string): number {
  if (row.band === "red") return 0;
  if (row.date < today) return 1;
  if (row.kind === "call" || row.task.startsWith("Follow up")) return 2;
  if (row.kind === "visit") return 3;
  return 4;
}

export function byWork(today: string) {
  return (a: Row, b: Row) =>
    Number(isUpcoming(a, today)) - Number(isUpcoming(b, today)) ||
    (isUpcoming(a, today) ? a.date.localeCompare(b.date) : 0) ||
    workRank(a, today) - workRank(b, today) ||
    BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
    a.slot.localeCompare(b.slot);
}

/** Every item for a family, open or done, one per concern: a person can have several. */
export function itemsFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row[] {
  const candidates: Row[] = [];

  for (const concern of concerns.filter((c) => c.familyId === family.id)) {
    const member = family.members.find((m) => m.id === concern.memberId);
    const booking = bookings.find((b) => b.concernId === concern.id);
    const base = { family, member, concernId: concern.id, band: concern.urgency as Band, date: today, slot: "", more: 0 };

    if (!booking && concern.source === "ivr") {
      // The family called the line and was told their ASHA will follow up:
      // that promise is this row.
      candidates.push({ ...base, kind: "call", task: "Follow up", note: "Called the voice line", day: "Today", sync: concern.sync });
    } else if (!booking) {
      const green = concern.urgency === "green";
      candidates.push({ ...base, kind: green ? "home" : "concern", task: green ? "Home care" : "Concern noted", note: concern.reasons[0], sync: concern.sync });
    } else if (booking.date >= today) {
      const task = booking.emergency ? "Emergency at the PHC" : "PHC visit";
      // An emergency has no time to wait for: it is "Now", not "Today, Now".
      const when = booking.emergency ? { day: "Now" } : { day: dayLabel(booking.date), time: slotLabel(booking.slot) };
      candidates.push({ ...base, kind: "visit", task, ...when, date: booking.date, slot: booking.emergency ? "" : booking.slot, sync: booking.sync });
    } else if (booking.followUpStatus === "pending" && booking.followUpDue && booking.followUpDue <= today) {
      const late = booking.followUpDue < today;
      candidates.push({ ...base, kind: "call", task: "Follow-up call", note: late ? `Was due ${dayLabel(booking.followUpDue).toLowerCase()}` : undefined, day: late ? "Late" : "Today", date: booking.followUpDue, sync: booking.sync });
    } else if (booking.followUpStatus === "missed" && booking.ashaAsked) {
      // Only when the doctor asked: a missed call alone commits nobody.
      candidates.push({ ...base, kind: "home", task: "Follow up at home", note: "Doctor asked: the follow-up call was missed", day: "Today", sync: booking.sync });
    } else {
      candidates.push({ ...base, band: "done", kind: "done", task: "Seen at the PHC", day: dayLabel(booking.date), date: booking.date, sync: booking.sync });
    }
  }
  return candidates.sort(byWork(today));
}

/**
 * One row per person: their first piece of work (today's before upcoming,
 * then by rank), with a count of the other open items, so nothing about a
 * person is hidden, only folded.
 */
export function rowsFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row[] {
  const items = itemsFor(family, concerns, bookings, today);
  const seen = new Set<string | undefined>();
  const rows: Row[] = [];
  for (const r of items) {
    const key = r.member?.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const others = items.filter((x) => x !== r && x.member?.id === key && x.band !== "done").length;
    rows.push({ ...r, more: r.band === "done" ? 0 : others });
  }
  return rows;
}

/** The family's most urgent row, for places that list families (the picker). */
export function rowFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row | null {
  return rowsFor(family, concerns, bookings, today)[0] ?? null;
}

/** "Kavya, 5": the person first, as the ASHA would say it. */
export function personLabel(row: Row): string {
  return row.member ? `${row.member.name}, ${row.member.age}` : row.family.head;
}

/**
 * Why this row: read from the row's own concern, never from another concern
 * of the same person. For an urgent result, the danger sign that made it
 * urgent; otherwise the first thing found. Only when the check found nothing
 * does it fall back to what the family said.
 */
export function reasonFor(row: Row, concerns: Concern[]): string | undefined {
  const concern = concerns.find((c) => c.id === row.concernId);
  const found = concern ? concern.reasons.slice(0, concern.answers.filter((a) => a.answer === "yes").length) : [];
  if (found.length > 0) return concern?.urgency === "red" ? found.at(-1) : found[0];
  if (row.member?.note) return row.member.note[0].toUpperCase() + row.member.note.slice(1);
  return undefined;
}
