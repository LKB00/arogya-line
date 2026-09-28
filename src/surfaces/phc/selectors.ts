// What the PHC dashboard shows, worked out apart from the screen so every edge
// case can be tested. Reads the store's shapes; decides nothing about triage.

import { isoDate } from "../../app/seed";
import type { Booking, Concern, Family, Urgency } from "../../app/types";
import type { BookingRow } from "./rows";

const URGENCY_ORDER: Record<Urgency, number> = { red: 0, amber: 1, green: 2 };

/** A day from the URL, or tomorrow when it is missing or not a real date. */
export function dayFromParam(param: string | null): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(new Date(param).getTime())) return param;
  return isoDate(1);
}

export function toRow(booking: Booking, concerns: Concern[], families: Family[]): BookingRow {
  const concern = concerns.find((c) => c.id === booking.concernId);
  const family = families.find((f) => f.id === concern?.familyId);
  const member = family?.members.find((m) => m.id === concern?.memberId);
  return { booking, concern, family, member };
}

/** The PHC only knows about bookings that have reached it. */
export function sent(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.sync === "sent");
}

/** A day's bookings: most urgent first, then by time. */
export function dayRows(bookings: Booking[], concerns: Concern[], families: Family[], day: string): BookingRow[] {
  return sent(bookings)
    .filter((b) => b.date === day)
    .map((b) => toRow(b, concerns, families))
    .sort((a, b) => {
      const ua = a.concern ? URGENCY_ORDER[a.concern.urgency] : 3;
      const ub = b.concern ? URGENCY_ORDER[b.concern.urgency] : 3;
      return ua - ub || a.booking.slot.localeCompare(b.booking.slot);
    });
}

/** Follow-ups still open (pending or missed), the most overdue first. */
export function followUpRows(bookings: Booking[], concerns: Concern[], families: Family[]): BookingRow[] {
  return sent(bookings)
    .filter((b) => b.followUpStatus === "pending" || b.followUpStatus === "missed")
    .map((b) => toRow(b, concerns, families))
    .sort((a, b) => (a.booking.followUpDue ?? "").localeCompare(b.booking.followUpDue ?? ""));
}

export type FollowUpState = "pending" | "overdue" | "missed" | "answered" | "none";

/** A pending follow-up whose day has passed is overdue, not merely pending. */
export function followUpState(b: Booking, today: string): FollowUpState {
  if (!b.followUpStatus) return "none";
  if (b.followUpStatus === "pending" && b.followUpDue && b.followUpDue < today) return "overdue";
  return b.followUpStatus;
}

export function percent(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

/** The doctor's workload for the day on screen: what needs them, not reporting. */
export function workload(rows: BookingRow[], bookings: Booking[], today: string) {
  const due = sent(bookings).filter((b) => {
    const state = followUpState(b, today);
    return state === "missed" || state === "overdue" || (state === "pending" && b.followUpDue === today);
  });
  return {
    patients: rows.length,
    urgent: rows.filter((r) => r.concern?.urgency === "red").length,
    toRecord: rows.filter((r) => !r.booking.advice).length,
    followUpsDue: due.length,
    missed: due.filter((b) => b.followUpStatus === "missed").length,
  };
}

/** How the whole loop is doing, across every booking that reached the PHC. */
export function outcomes(bookings: Booking[]) {
  const all = sent(bookings);
  const preBooked = all.filter((b) => !b.walkIn).length;
  const avoidable = all.filter((b) => b.avoidable === true).length;
  const withFollowUp = all.filter((b) => b.followUpStatus !== undefined);
  const answered = withFollowUp.filter((b) => b.followUpStatus === "answered").length;
  return { total: all.length, preBooked, avoidable, followUps: withFollowUp.length, answered };
}
