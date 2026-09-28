import { describe, expect, it } from "vitest";
import { createSeed, isoDate } from "../../app/seed";
import type { Booking, Concern, Family } from "../../app/types";
import { byWork, isUpcoming, personLabel, reasonFor, rowFor, rowsFor } from "./rows";

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
    expect(row.day).toBe("Today");
  });

  it("a follow-up due today is a call, today", () => {
    const s = seed();
    const row = rowFor(fam(s, "2205"), s.concerns, s.bookings, today)!;
    expect(row.kind).toBe("call");
    expect(row.day).toBe("Today");
  });

  it("a missed follow-up the doctor handed to her becomes a home follow-up, and says why", () => {
    const s = seed();
    const row = rowFor(fam(s, "7809"), s.concerns, s.bookings, today)!;
    expect(row.kind).toBe("home");
    expect(row.note).toMatch(/doctor asked/i);
  });

  it("a missed follow-up nobody has decided on is not her task", () => {
    const s = seed();
    const undecided = s.bookings.map((b) => (b.id === "b-7809" ? { ...b, ashaAsked: undefined } : b));
    const row = rowFor(fam(s, "7809"), s.concerns, undecided, today)!;
    expect(row.band).toBe("done");
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

  it("two people with open concerns in one family are two rows, most urgent first", () => {
    const s = seed();
    const dad: Concern = { ...s.concerns[0], id: "c-dad", familyId: "3120", memberId: "3120-1", urgency: "amber", reasons: ["Fever more than 2 days"] };
    const rows = rowsFor(fam(s, "3120"), [...s.concerns, dad], s.bookings, today);
    expect(rows.map((r) => r.member?.name)).toEqual(["Kavya", "Manjunath"]);
  });

  it("one person with two concerns is one row, under the most urgent", () => {
    const s = seed();
    const green: Concern = { ...s.concerns[0], id: "c-g2", familyId: "3120", memberId: "3120-2", urgency: "green" };
    const rows = rowsFor(fam(s, "3120"), [green, ...s.concerns], s.bookings, today);
    expect(rows).toHaveLength(1);
    expect(rows[0].band).toBe("red");
  });

  it("an overdue follow-up call is still a call today, not seen", () => {
    const s = seed();
    const late: Booking = { ...s.bookings[2], followUpDue: isoDate(-1) };
    const row = rowFor(fam(s, "2205"), s.concerns, [s.bookings[0], s.bookings[1], late, s.bookings[3]], today)!;
    expect(row.kind).toBe("call");
  });

  it("a family's call to the line with no urgent sign puts a follow-up on her list", () => {
    const s = seed();
    const ivr: Concern = { ...s.concerns[0], id: "c-ivr", familyId: "4471", memberId: "4471-2", source: "ivr", urgency: "green" };
    const row = rowFor(fam(s, "4471"), [...s.concerns, ivr], s.bookings, today)!;
    expect(row.task).toBe("Follow up");
    expect(row.note).toBe("Called the voice line");
    expect(row.day).toBe("Today");
  });

  it("a visit tomorrow is upcoming, never today's work", () => {
    const s = seed();
    const tomorrow: Booking = { ...s.bookings[0], date: isoDate(1) };
    const row = rowFor(fam(s, "3120"), s.concerns, [tomorrow, ...s.bookings.slice(1)], today)!;
    expect(isUpcoming(row, today)).toBe(true);
  });

  it("up next is the work that is due, not the brightest colour", () => {
    const s = seed();
    // Kavya: red, but her visit is tomorrow. Shobha: a follow-up call due today.
    const tomorrow: Booking = { ...s.bookings[0], date: isoDate(1) };
    const bookings = [tomorrow, ...s.bookings.slice(1)];
    const rows = s.families.flatMap((f) => rowsFor(f, s.concerns, bookings, today)).filter((r) => r.band !== "done").sort(byWork(today));
    const todays = rows.filter((r) => !isUpcoming(r, today));
    expect(todays[0].member?.name).not.toBe("Kavya");
    expect(rows.at(-1)?.member?.name).toBe("Kavya"); // upcoming, last
  });

  it("a person with two open items shows once, with the other counted", () => {
    const s = seed();
    const second: Concern = { ...s.concerns[0], id: "c-k2", source: "ivr", urgency: "green" }; // Kavya again, from the line
    const rows = rowsFor(fam(s, "3120"), [...s.concerns, second], s.bookings, today);
    expect(rows).toHaveLength(1);
    expect(rows[0].more).toBe(1);
  });
});

