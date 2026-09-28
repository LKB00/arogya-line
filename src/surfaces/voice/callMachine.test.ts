import { describe, expect, it } from "vitest";
import { createSeed, isoDate } from "../../app/seed";
import { hangUp, press, startCall, tick, type Call, type Env, type Key, type Step } from "./callMachine";

function env(): Env {
  const seed = createSeed();
  // A fixed early hour, so "today" still has slots whatever the clock says.
  return { families: seed.families, concerns: seed.concerns, bookings: seed.bookings, today: isoDate(0), hour: 7 };
}

/** Press a run of keys, collecting every effect the machine asked for. */
function type(step: Step, keys: string, e: Env): Step {
  let call: Call = step.call;
  const effects = [...step.effects];
  for (const key of keys.split("")) {
    const next = press(call, key as Key, e);
    call = next.call;
    effects.push(...next.effects);
  }
  return { call, effects };
}

const said = (call: Call) => call.transcript.map((l) => l.text).join(" | ");

describe("family ID entry", () => {
  it("asks for the ID, then reaches the main menu on a known family", () => {
    const e = env();
    const start = startCall(e);
    expect(start.call.state).toBe("enterFamilyId");
    const after = type(start, "4471", e);
    expect(after.call.state).toBe("mainMenu");
    expect(after.call.familyId).toBe("4471");
    expect(said(after.call)).toContain("Lakshmi");
  });

  it("asks again after a wrong ID", () => {
    const e = env();
    const after = type(startCall(e), "1111", e);
    expect(after.call.state).toBe("enterFamilyId");
    expect(after.call.familyId).toBeNull();
    expect(said(after.call)).toContain("not found");
  });

  it("skips straight to the menu when the URL carries the family", () => {
    const e = env();
    expect(startCall(e, { familyId: "4471" }).call.state).toBe("mainMenu");
  });

  it("goes straight to the operator in emergency mode", () => {
    const e = env();
    const start = startCall(e, { familyId: "4471", emergency: true });
    expect(start.call.state).toBe("operator");
  });
});

describe("triage over the keypad", () => {
  it("child, two amber yeses and no danger sign, offers a booking", () => {
    const e = env();
    // 4471 → menu 1 → child → yes, yes, no, no
    const after = type(startCall(e), "4471" + "1" + "1" + "1122", e);
    expect(after.call.result?.urgency).toBe("amber");
    expect(after.call.state).toBe("offerBooking");
    expect(after.effects).toHaveLength(0); // nothing written until the caller books
  });

  it("1 reads the choice back and books nothing until it is confirmed", () => {
    const e = env();
    const chosen = type(startCall(e), "4471" + "1" + "1" + "1122" + "1", e);
    expect(chosen.call.state).toBe("confirmBooking");
    expect(said(chosen.call)).toContain("You are booking a visit for Arjun, tomorrow");
    expect(chosen.effects).toHaveLength(0);
  });

  it("2 at the read-back offers another day instead of booking", () => {
    const e = env();
    const back = type(startCall(e), "4471" + "1" + "1" + "1122" + "1" + "2", e);
    expect(back.call.state).toBe("offerBooking");
    expect(back.call.offerDate).toBe(isoDate(2));
    expect(back.effects).toHaveLength(0);
  });

  it("1 then 1 books the offered slot as an ivr concern plus booking", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "1" + "1122" + "11", e);
    expect(after.call.state).toBe("ended");
    expect(after.effects).toEqual([
      expect.objectContaining({ type: "book", date: isoDate(1), concern: expect.objectContaining({ source: "ivr", urgency: "amber" }) }),
    ]);
  });

  it("2 offers the next day instead", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "1" + "1122", e);
    const another = type(offered, "2", e);
    expect(another.call.state).toBe("offerBooking");
    expect(another.call.offerDate).toBe(isoDate(2));
  });

  it("a danger sign yes ends triage red and connects the operator", () => {
    const e = env();
    // child: fever no, vomiting no, feeding no, breathing yes
    const after = type(startCall(e), "4471" + "1" + "1" + "2221", e);
    expect(after.call.result?.urgency).toBe("red");
    expect(after.call.state).toBe("operator");
  });

  it("green speaks home care, promises the ASHA visit, and saves a concern", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "1" + "2222", e);
    expect(after.call.state).toBe("resultGreen");
    expect(said(after.call)).toContain("No urgent signs found.");
    expect(said(after.call)).toContain("At home: give small sips of fluid often");
    expect(said(after.call)).toContain("Call again if: breathing becomes fast or difficult");
    expect(said(after.call)).toContain("Your ASHA will visit tomorrow.");
    expect(after.effects).toEqual([expect.objectContaining({ type: "concern", concern: expect.objectContaining({ urgency: "green" }) })]);
  });

  it("9 repeats the current question without answering it", () => {
    const e = env();
    const asked = type(startCall(e), "4471" + "1" + "1", e);
    const repeated = type(asked, "9", e);
    expect(repeated.call.state).toBe("triageQuestion");
    expect(repeated.call.answers).toEqual(asked.call.answers);
    expect(repeated.call.transcript.length).toBeGreaterThan(asked.call.transcript.length);
  });

  it("0 mid-question jumps to the operator, who books the same day", () => {
    const e = env();
    const midway = type(startCall(e), "4471" + "1" + "1" + "1", e);
    expect(midway.call.state).toBe("triageQuestion");
    const operator = type(midway, "0", e);
    expect(operator.call.state).toBe("operator");

    const first = tick(operator.call, e);
    expect(first.call.state).toBe("operator");
    expect(first.effects).toHaveLength(0);
    const second = tick(first.call, e);
    expect(second.call.state).toBe("ended");
    expect(second.effects).toEqual([expect.objectContaining({ type: "book", date: isoDate(0) })]);
  });
});

describe("menu 3, hear the doctor's advice", () => {
  it("says there is no advice yet for a family without one", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "3", e);
    expect(after.call.state).toBe("readAdvice");
    expect(said(after.call)).toContain("No advice yet.");
  });

  it("reads back the saved advice for a family that has one", () => {
    const e = env();
    const after = type(startCall(e), "2205" + "3", e);
    expect(said(after.call)).toContain("Take the iron tablet after food");
  });

  it("reads advice a doctor saved during the demo", () => {
    const e = env();
    const booking = e.bookings.find((b) => b.concernId === "c-3120")!;
    const withAdvice: Env = {
      ...e,
      bookings: e.bookings.map((b) => (b.id === booking.id ? { ...b, advice: "Steam twice a day." } : b)),
    };
    const after = type(startCall(withAdvice), "3120" + "3", withAdvice);
    expect(said(after.call)).toContain("Steam twice a day.");
  });
});

describe("hang up", () => {
  it("returns to idle with an empty transcript", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1", e);
    const done = hangUp();
    expect(done.call.state).toBe("idle");
    expect(done.call.transcript).toEqual([]);
    expect(after.call.transcript.length).toBeGreaterThan(0);
  });
});

describe("edge cases found in the design pass", () => {
  it("speaks the result in words, never the colour code", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "1" + "1122", e);
    expect(said(after.call)).toContain("Result: needs a visit.");
    expect(said(after.call)).not.toMatch(/Result: (amber|red|green)/);
  });

  it("reads the advice date the way a person says it", () => {
    const e = env();
    const after = type(startCall(e), "2205" + "3", e);
    expect(said(after.call)).toContain("from Dr. Ramesh, yesterday:");
    expect(said(after.call)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("never dates advice in the future", () => {
    const e = env();
    const bookings = e.bookings.map((b) => (b.id === "b-3120" ? { ...b, advice: "Keep her upright." } : b));
    const after = type(startCall({ ...e, bookings }, { familyId: "3120" }), "3", { ...e, bookings });
    expect(said(after.call)).toContain("Your doctor's advice from Dr. Ramesh: Keep her upright.");
  });

  it("asks again when nobody of that kind is in the family", () => {
    const e = env();
    // 3120 has an adult and a child, no pregnant woman
    const after = type(startCall(e), "3120" + "1" + "3", e);
    expect(after.call.state).toBe("whoIsUnwell");
    expect(said(after.call)).toContain("There is no pregnant woman recorded in family 3120.");
  });

  it("books exactly the slot it offered", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "1" + "1122", e);
    const { offerDate, offerSlot } = offered.call;
    const booked = type(offered, "11", e);
    const book = booked.effects.find((x) => x.type === "book");
    expect(book).toMatchObject({ date: offerDate, slot: offerSlot });
  });

  it("says so, and offers another, when the offered slot is taken meanwhile", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "1" + "1122", e);
    const taken: Env = {
      ...e,
      bookings: [...e.bookings, { ...e.bookings[0], id: "b-x", date: offered.call.offerDate!, slot: offered.call.offerSlot! }],
    };
    const confirming = press(offered.call, "1", taken);
    const after = press(confirming.call, "1", taken);
    expect(after.effects).toHaveLength(0);
    expect(said(after.call)).toContain("Sorry, that slot has just been taken.");
    expect(after.call.state).toBe("offerBooking");
    expect(after.call.offerSlot).not.toBe(offered.call.offerSlot);
  });

  it("late in the day, the operator books the next real slot, not one already past", () => {
    const e = { ...env(), hour: 22 };
    let step = type(startCall(e), "4471" + "0", e);
    step = tick(step.call, e);
    step = tick(step.call, e);
    const book = step.effects.find((x) => x.type === "book");
    expect(book).toMatchObject({ date: isoDate(1) });
  });

  it("an emergency says come now first, with the booking as the record", () => {
    const e = { ...env(), hour: 22 };
    let step = startCall(e, { familyId: "3120", emergency: true });
    step = tick(step.call, e);
    step = tick(step.call, e);
    expect(said(step.call)).toContain("now; you will be seen as an emergency");
  });
});
