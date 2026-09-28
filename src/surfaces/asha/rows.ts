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
  sync: SyncStatus;
};

/** One row per person with something open or done, most urgent first. */
export function rowsFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row[] {
  const candidates: Row[] = [];

  for (const concern of concerns.filter((c) => c.familyId === family.id)) {
    const member = family.members.find((m) => m.id === concern.memberId);
    const booking = bookings.find((b) => b.concernId === concern.id);
    const base = { family, member, band: concern.urgency as Band };

    if (!booking && concern.source === "ivr") {
      // The family called the line and was told their ASHA will follow up:
      // that promise is this row.
      candidates.push({ ...base, kind: "call", task: "Follow up", note: "Called the voice line", day: "Today", sync: concern.sync });
    } else if (!booking) {
      const green = concern.urgency === "green";
      candidates.push({ ...base, kind: green ? "home" : "concern", task: green ? "Home care" : "Concern noted", note: concern.reasons[0], sync: concern.sync });
    } else if (booking.date >= today) {
      candidates.push({ ...base, kind: "visit", task: "PHC visit", day: dayLabel(booking.date), time: slotLabel(booking.slot), sync: booking.sync });
    } else if (booking.followUpStatus === "pending" && booking.followUpDue && booking.followUpDue <= today) {
      candidates.push({ ...base, kind: "call", task: "Follow-up call", day: "Today", sync: booking.sync });
    } else if (booking.followUpStatus === "missed" && booking.ashaAsked) {
      // Only when the doctor asked: a missed call alone commits nobody.
      candidates.push({ ...base, kind: "home", task: "Follow up at home", note: "Doctor asked: the follow-up call was missed", day: "Today", sync: booking.sync });
    } else {
      candidates.push({ ...base, band: "done", kind: "done", task: "Seen at the PHC", day: dayLabel(booking.date), sync: booking.sync });
    }
  }

  candidates.sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band]);
  // A person with several concerns shows once, under the most urgent.
  const seen = new Set<string | undefined>();
  return candidates.filter((r) => {
    const key = r.member?.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The family's most urgent row, for places that list families (the picker). */
export function rowFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row | null {
  return rowsFor(family, concerns, bookings, today)[0] ?? null;
}

/** "Kavya, 5": the person first, as the ASHA would say it. */
export function personLabel(row: Row): string {
  return row.member ? `${row.member.name}, ${row.member.age}` : row.family.head;
}

/** Why this person: what the family noticed, else the first finding. */
export function reasonFor(row: Row, concerns: Concern[]): string | undefined {
  if (row.member?.note) return row.member.note[0].toUpperCase() + row.member.note.slice(1);
  const concern = concerns.find((c) => c.familyId === row.family.id && c.memberId === row.member?.id);
  return concern?.reasons[0];
}
