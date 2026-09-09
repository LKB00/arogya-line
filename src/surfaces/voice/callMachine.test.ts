import { describe, expect, it } from "vitest";
import { createSeed, isoDate } from "../../app/seed";
import { hangUp, press, startCall, tick, type Call, type Env, type Key, type Step } from "./callMachine";

function env(): Env {
  const seed = createSeed();
  return { families: seed.families, concerns: seed.concerns, bookings: seed.bookings, today: isoDate(0) };
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

  it("1 books the offered slot as an ivr concern plus booking", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "1" + "1122" + "1", e);
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
