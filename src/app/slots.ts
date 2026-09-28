// The one rule for whether a PHC slot can be booked, shared by every surface
// and enforced by the store at the moment of writing: the ASHA booking
// screen, the voice line when it offers a time and again when the caller
// confirms it, and createBooking itself. A screen may warn; only this decides.

import type { Booking } from "./types";

/** The hour a slot starts, from "09:00–10:00". */
export function slotStartHour(slot: string): number {
  return Number(slot.slice(0, 2));
}

/** Is this slot already held? An emergency arrival holds no slot. */
export function slotTaken(bookings: Booking[], date: string, slot: string): boolean {
  return bookings.some((b) => !b.emergency && b.date === date && b.slot === slot);
}

/** A slot on a past day, or today's once its hour has started, cannot be booked. */
export function slotPassed(date: string, slot: string, today: string, hour: number): boolean {
  return date < today || (date === today && slotStartHour(slot) <= hour);
}

export function isBookable(bookings: Booking[], date: string, slot: string, today: string, hour: number): boolean {
  return !slotPassed(date, slot, today, hour) && !slotTaken(bookings, date, slot);
}
