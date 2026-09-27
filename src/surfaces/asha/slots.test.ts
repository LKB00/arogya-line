import { describe, expect, it } from "vitest";
import type { Booking } from "../../app/types";
import { slotState } from "./slots";

const today = "2026-09-27";
const tomorrow = "2026-09-28";
const at = (hour: number) => new Date(2026, 8, 27, hour, 30);
const booked = (date: string, slot: string) => ({ date, slot }) as Booking;

describe("slotState", () => {
  it("an untaken future slot is open", () => {
    expect(slotState("10:00–11:00", tomorrow, [], today, at(22))).toBe("open");
  });

  it("a slot another booking holds is full", () => {
    expect(slotState("10:00–11:00", tomorrow, [booked(tomorrow, "10:00–11:00")], today, at(8))).toBe("full");
  });

  it("today, a slot whose hour has started is past", () => {
    expect(slotState("09:00–10:00", today, [], today, at(9))).toBe("past");
    expect(slotState("14:00–15:00", today, [], today, at(9))).toBe("open");
  });

  it("late in the day, every slot today is past", () => {
    for (const s of ["09:00–10:00", "10:00–11:00", "11:00–12:00", "14:00–15:00"]) {
      expect(slotState(s, today, [], today, at(22))).toBe("past");
    }
  });

  it("past wins over full, so the reason shown is the true one", () => {
    expect(slotState("09:00–10:00", today, [booked(today, "09:00–10:00")], today, at(12))).toBe("past");
  });
});
