// Whether a PHC slot can still be booked. Display logic for the booking
// screen: a slot is full when another booking holds it, and past when it is
// today and its hour has already started.

import type { Booking } from "../../app/types";

export type SlotState = "open" | "full" | "past";

/** The hour a slot starts, from "09:00–10:00". */
export function slotStartHour(slot: string): number {
  return Number(slot.slice(0, 2));
}

export function slotState(slot: string, date: string, bookings: Booking[], today: string, now: Date): SlotState {
  if (date === today && slotStartHour(slot) <= now.getHours()) return "past";
  if (bookings.some((b) => b.date === date && b.slot === slot)) return "full";
  return "open";
}
