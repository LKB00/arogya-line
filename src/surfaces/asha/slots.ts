// Whether a PHC slot can still be booked, for the booking screen's display:
// full when another booking holds it, past when its hour has started. The
// rule itself lives in app/slots.ts, shared with the voice line and the store.

import { slotPassed, slotStartHour, slotTaken } from "../../app/slots";
import type { Booking } from "../../app/types";

export { slotStartHour };

export type SlotState = "open" | "full" | "past";

export function slotState(slot: string, date: string, bookings: Booking[], today: string, now: Date): SlotState {
  if (slotPassed(date, slot, today, now.getHours())) return "past";
  if (slotTaken(bookings, date, slot)) return "full";
  return "open";
}
