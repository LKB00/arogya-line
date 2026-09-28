// What the PHC dashboard shows, worked out apart from the screen so every edge
// case can be tested. Reads the store's shapes; decides nothing about triage.

import { isoDate } from "../../app/seed";
import type { Booking, Concern, Family, Urgency } from "../../app/types";
import type { BookingRow } from "./rows";

const URGENCY_ORDER: Record<Urgency, number> = { red: 0, amber: 1, green: 2 };

/** A day from the URL, or today when it is missing or not a real date: a doctor opens on today. */
export function dayFromParam(param: string | null): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(new Date(param).getTime())) return param;
  return isoDate(0);
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

/**
 * A day's bookings in the order they will walk in: by time, then the most
 * urgent first within a slot. Urgency is signalled on the row, not used as
 * the sort, so the doctor always knows who is next.
 */
export function dayRows(bookings: Booking[], concerns: Concern[], families: Family[], day: string): BookingRow[] {
  return sent(bookings)
    .filter((b) => b.date === day)
    .map((b) => toRow(b, concerns, families))
    .sort((a, b) => {
      const ua = a.concern ? URGENCY_ORDER[a.concern.urgency] : 3;
      const ub = b.concern ? URGENCY_ORDER[b.concern.urgency] : 3;
      return a.booking.slot.localeCompare(b.booking.slot) || ua - ub;
    });
}

/** Follow-ups still open (pending or missed), the most overdue first. */
export function followUpRows(bookings: Booking[], concerns: Concern[], families: Family[]): BookingRow[] {
  return sent(bookings)
    .filter((b) => b.followUpStatus === "pending" || b.followUpStatus === "missed")
    .map((b) => toRow(b, concerns, families))
    .sort((a, b) => (a.booking.followUpDue ?? "").localeCompare(b.booking.followUpDue ?? ""));
}

export type FollowUpState = "pending" | "overdue" | "missed" | "handed" | "answered" | "none";

/**
 * A pending follow-up whose day has passed is overdue, not merely pending. A
 * missed call is only the ASHA's once the doctor has asked her ("handed");
 * until then someone at the PHC still has to decide what happens next.
 */
export function followUpState(b: Booking, today: string): FollowUpState {
  if (!b.followUpStatus) return "none";
  if (b.followUpStatus === "pending" && b.followUpDue && b.followUpDue < today) return "overdue";
  if (b.followUpStatus === "missed" && b.ashaAsked) return "handed";
  return b.followUpStatus;
}

/** Who has to act on an open follow-up, and when: the doctor now, the ASHA, or later. */
export type FollowUpGroup = "now" | "asha" | "upcoming";

export function followUpGroup(b: Booking, today: string): FollowUpGroup | null {
  const state = followUpState(b, today);
  if (state === "overdue" || state === "missed" || (state === "pending" && b.followUpDue === today)) return "now";
  if (state === "handed") return "asha";
  if (state === "pending") return "upcoming";
  return null;
}

/**
 * Where a booking stands for the doctor. A consult can only be recorded for a
 * patient who can be in the room: today's booking, one whose day has passed,
 * or (demo only) a future one marked as arrived. Tomorrow's is a booking to
 * view, never a consult to record.
 */
export type ConsultState = "future" | "today" | "overdue" | "done";

export function consultState(b: Booking, today: string): ConsultState {
  if (b.advice) return "done";
  if (b.date > today && !b.arrived) return "future";
  return b.date < today ? "overdue" : "today";
}

export function percent(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

/** The doctor's workload for the day on screen: what needs them, not reporting. */
export function workload(rows: BookingRow[], bookings: Booking[], today: string) {
  // The same "now" group the Follow-ups view leads with, so the two never disagree.
  const due = sent(bookings).filter((b) => followUpGroup(b, today) === "now");
  return {
    patients: rows.length,
    urgent: rows.filter((r) => r.concern?.urgency === "red").length,
    // Only patients who can be in the room: tomorrow's are not advice to record.
    toRecord: rows.filter((r) => ["today", "overdue"].includes(consultState(r.booking, today))).length,
    notArrived: rows.filter((r) => consultState(r.booking, today) === "future").length,
    followUpsDue: due.length,
    missed: due.filter((b) => b.followUpStatus === "missed").length,
  };
}

/** How the whole loop is doing, across every booking that reached the PHC. */
export function outcomes(bookings: Booking[]) {
  const all = sent(bookings);
  const preBooked = all.filter((b) => !b.walkIn).length;
  // "Potential trips avoided": a learning signal about referrals, not a score.
  const avoidable = all.filter((b) => b.avoidable === true).length;
  const withFollowUp = all.filter((b) => b.followUpStatus !== undefined);
  const answered = withFollowUp.filter((b) => b.followUpStatus === "answered").length;
  return { total: all.length, preBooked, avoidable, followUps: withFollowUp.length, answered };
}
