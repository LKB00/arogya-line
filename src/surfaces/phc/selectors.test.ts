import { describe, expect, it } from "vitest";
import { createSeed, isoDate } from "../../app/seed";
import type { Booking } from "../../app/types";
import { dayFromParam, dayRows, followUpRows, followUpState, outcomes, percent, workload } from "./selectors";

describe("dayFromParam", () => {
  it("keeps a real date", () => expect(dayFromParam("2026-09-30")).toBe("2026-09-30"));
  it("falls back to today when missing or not a date", () => {
    expect(dayFromParam(null)).toBe(isoDate(0));
    expect(dayFromParam("")).toBe(isoDate(0));
    expect(dayFromParam("banana")).toBe(isoDate(0));
    expect(dayFromParam("2026-13-45")).toBe(isoDate(0));
  });
});

describe("dayRows", () => {
  it("lists only bookings that have reached the PHC, by time", () => {
    const s = createSeed();
    const offline: Booking = { ...s.bookings[0], id: "b-off", slot: "14:00–15:00", sync: "saved_offline" };
    const rows = dayRows([...s.bookings, offline], s.concerns, s.families, isoDate(0));
    expect(rows.map((r) => r.booking.id)).toEqual(["b-3120", "b-5638"]);
  });

  it("time sets the order, even when a later booking is more urgent", () => {
    const s = createSeed();
    const lateRed: Booking = { ...s.bookings[0], id: "b-late", slot: "14:00–15:00" }; // Kavya's red concern
    const early: Booking = { ...s.bookings[1], id: "b-early", slot: "09:00–10:00" };
    const rows = dayRows([lateRed, early], s.concerns, s.families, isoDate(0));
    expect(rows.map((r) => r.booking.id)).toEqual(["b-early", "b-late"]);
  });

  it("an empty day is an empty list", () => {
    const s = createSeed();
    expect(dayRows(s.bookings, s.concerns, s.families, isoDate(9))).toEqual([]);
  });

  it("within one slot, the most urgent first; a walk-in with nothing recorded after", () => {
    const s = createSeed();
    const walkIn: Booking = { ...s.bookings[0], id: "b-walk", concernId: "none", slot: "09:00–10:00", walkIn: true };
    const rows = dayRows([walkIn, ...s.bookings], s.concerns, s.families, isoDate(0));
    expect(rows.map((r) => r.booking.id).slice(0, 2)).toEqual(["b-3120", "b-walk"]);
    expect(rows[1].member).toBeUndefined();
  });
});

describe("follow-ups", () => {
  it("lists pending and missed, not answered", () => {
    const s = createSeed();
    const answered: Booking = { ...s.bookings[2], id: "b-ans", followUpStatus: "answered" };
    const ids = followUpRows([...s.bookings, answered], s.concerns, s.families).map((r) => r.booking.id);
    expect(ids).toContain("b-2205");
    expect(ids).toContain("b-7809");
    expect(ids).not.toContain("b-ans");
  });

  it("a pending call whose day has passed is overdue", () => {
    const b = { followUpStatus: "pending", followUpDue: isoDate(-1) } as Booking;
    expect(followUpState(b, isoDate(0))).toBe("overdue");
    expect(followUpState({ ...b, followUpDue: isoDate(0) }, isoDate(0))).toBe("pending");
    expect(followUpState({} as Booking, isoDate(0))).toBe("none");
  });
});

describe("outcomes", () => {
  it("never divides by zero", () => {
    expect(percent(0, 0)).toBe("—");
    expect(outcomes([]).total).toBe(0);
  });

  it("counts from the seed", () => {
    const o = outcomes(createSeed().bookings);
    expect(o).toMatchObject({ total: 4, preBooked: 3, avoidable: 1, followUps: 2, answered: 0 });
  });
});

describe("workload", () => {
  it("today in the seed: 2 patients, 1 urgent, 2 with advice to record", () => {
    const s = createSeed();
    const rows = dayRows(s.bookings, s.concerns, s.families, isoDate(0));
    expect(workload(rows, s.bookings, isoDate(0))).toMatchObject({ patients: 2, urgent: 1, toRecord: 2 });
  });

  it("follow-ups due: today's, overdue and missed, not later ones", () => {
    const s = createSeed();
    const later: Booking = { ...s.bookings[2], id: "b-later", followUpDue: isoDate(2) };
    const w = workload([], [...s.bookings, later], isoDate(0));
    expect(w.followUpsDue).toBe(2); // b-2205 due today, b-7809 missed
    expect(w.missed).toBe(1);
  });
});
