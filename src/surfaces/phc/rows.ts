// The dashboard row shape and its label helpers. They live apart from the row
// component so both the table and AfterConsult can read them.

import { memberAge } from "../../app/format";
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

/** The patient's name, then the line beneath it: age and family ID. */
export function patientName(row: BookingRow): string {
  return row.member?.name ?? "Unknown patient";
}

export function patientMeta(row: BookingRow): string {
  const age = row.member ? memberAge(row.member) : undefined;
  const fam = `Family ${row.family?.id ?? "—"}`;
  return age ? `${age} · ${fam}` : fam;
}
