// The dashboard row shape and its label helpers. They live apart from the row
// component so both the table and AfterConsult can read them.

import type { Booking, Concern, Family, Member } from "../../app/types";

export type BookingRow = {
  booking: Booking;
  concern?: Concern;
  family?: Family;
  member?: Member;
};

export function reportedBy(row: BookingRow): string {
  if (row.booking.walkIn) return "Walk-in";
  return row.concern?.source === "ivr" ? "Voice line" : "ASHA";
}

export function patientLabel(row: BookingRow): string {
  const who = row.member ? `${row.member.name}, ${row.member.age}` : "Unknown";
  return `${who} · family ${row.family?.id ?? "—"}`;
}
