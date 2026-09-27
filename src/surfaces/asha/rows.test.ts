import { describe, expect, it } from "vitest";
import { createSeed, isoDate } from "../../app/seed";
import type { Booking, Concern, Family } from "../../app/types";
import { personLabel, reasonFor, rowFor } from "./rows";

const today = isoDate(0);
const seed = () => createSeed();
const fam = (s: ReturnType<typeof createSeed>, id: string) => s.families.find((f) => f.id === id) as Family;

describe("rowFor: what each family needs today", () => {
  it("a family with nothing open has no row", () => {
    const s = seed();
    expect(rowFor(fam(s, "4471"), s.concerns, s.bookings, today)).toBeNull();
  });

  it("an upcoming booking is a PHC visit, about the person, not the family head", () => {
    const s = seed();
    const row = rowFor(fam(s, "3120"), s.concerns, s.bookings, today)!;
    expect(row.kind).toBe("visit");
    expect(row.band).toBe("red");
    expect(personLabel(row)).toBe("Kavya, 5");
    expect(row.day).toBe("Tomorrow");
  });

  it("a follow-up due today is a call, today", () => {
    const s = seed();
    const row = rowFor(fam(s, "2205"), s.concerns, s.bookings, today)!;
    expect(row.kind).toBe("call");
    expect(row.day).toBe("Today");
  });

  it("a missed follow-up becomes a home visit, and says why", () => {
    const s = seed();
    const row = rowFor(fam(s, "7809"), s.concerns, s.bookings, today)!;
    expect(row.kind).toBe("home");
    expect(row.note).toMatch(/missed/i);
  });

  it("a concern with no booking yet is still on the list", () => {
    const s = seed();
    const c: Concern = { ...s.concerns[0], id: "c-new", familyId: "4471", memberId: "4471-2", urgency: "amber", sync: "saved_offline" };
    const row = rowFor(fam(s, "4471"), [...s.concerns, c], s.bookings, today)!;
    expect(row.kind).toBe("concern");
    expect(row.sync).toBe("saved_offline");
  });

  it("with several concerns, the most urgent one leads", () => {
    const s = seed();
    const green: Concern = { ...s.concerns[0], id: "c-g", familyId: "3120", memberId: "3120-1", urgency: "green" };
    const row = rowFor(fam(s, "3120"), [green, ...s.concerns], s.bookings, today)!;
    expect(row.band).toBe("red");
  });

  it("a past visit with no follow-up counts as seen, not open", () => {
    const s = seed();
    const past: Booking = { ...s.bookings[0], date: isoDate(-2) };
    const row = rowFor(fam(s, "3120"), s.concerns, [past, ...s.bookings.slice(1)], today)!;
    expect(row.band).toBe("done");
  });

  it("the reason is what the family said, capitalised, before any finding", () => {
    const s = seed();
    const row = rowFor(fam(s, "3120"), s.concerns, s.bookings, today)!;
    expect(reasonFor(row, s.concerns)).toBe("Breathing fast");
  });
});
