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
    // 4471 → menu 1 → Arjun (2) → yes, yes, no, no
    const after = type(startCall(e), "4471" + "1" + "2" + "1122", e);
    expect(after.call.result?.urgency).toBe("amber");
    expect(after.call.state).toBe("offerBooking");
    expect(after.effects).toHaveLength(0); // nothing written until the caller books
  });

  it("1 reads the choice back and books nothing until it is confirmed", () => {
    const e = env();
    const chosen = type(startCall(e), "4471" + "1" + "2" + "1122" + "1", e);
    expect(chosen.call.state).toBe("confirmBooking");
    expect(said(chosen.call)).toContain("You are booking a visit for Arjun, tomorrow");
    expect(chosen.effects).toHaveLength(0);
  });

  it("2 at the read-back offers another day instead of booking", () => {
    const e = env();
    const back = type(startCall(e), "4471" + "1" + "2" + "1122" + "1" + "2", e);
    expect(back.call.state).toBe("offerBooking");
    expect(back.call.offerDate).toBe(isoDate(2));
    expect(back.effects).toHaveLength(0);
  });

  it("1 then 1 books the offered slot as an ivr concern plus booking", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "2" + "1122" + "11", e);
    expect(after.call.state).toBe("ended");
    expect(after.effects).toEqual([
      expect.objectContaining({ type: "book", date: isoDate(1), concern: expect.objectContaining({ source: "ivr", urgency: "amber" }) }),
    ]);
  });

  it("2 offers the next day instead", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "2" + "1122", e);
    const another = type(offered, "2", e);
    expect(another.call.state).toBe("offerBooking");
    expect(another.call.offerDate).toBe(isoDate(2));
  });

  it("a danger sign yes ends triage red and connects the operator", () => {
    const e = env();
    // child: fever no, vomiting no, feeding no, breathing yes
    const after = type(startCall(e), "4471" + "1" + "2" + "2221", e);
    expect(after.call.result?.urgency).toBe("red");
    expect(after.call.state).toBe("operator");
  });

  it("green speaks home care, promises the ASHA visit, and saves a concern", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "2" + "2222", e);
    expect(after.call.state).toBe("resultGreen");
    expect(said(after.call)).toContain("From your answers, there are no urgent signs for Arjun.");
    // Spoken as a person says it, not a list read aloud.
    expect(said(after.call)).toContain("At home, give small sips of fluid often, keep the child cool");
    expect(said(after.call)).toContain("Call us again if the breathing becomes fast or difficult");
    // Promises only what the system does: the concern puts a follow-up on her list.
    expect(said(after.call)).toContain("Your ASHA, Savitri, has been told and will follow up with you.");
    expect(said(after.call)).not.toContain("visit tomorrow");
    expect(after.effects).toEqual([
      expect.objectContaining({ type: "concern", concern: expect.objectContaining({ urgency: "green", homeCare: expect.objectContaining({ tell: expect.any(Array) }) }) }),
    ]);
  });

  it("9 repeats the current question without answering it", () => {
    const e = env();
    const asked = type(startCall(e), "4471" + "1" + "1", e);
    const repeated = type(asked, "9", e);
    expect(repeated.call.state).toBe("triageQuestion");
    expect(repeated.call.answers).toEqual(asked.call.answers);
    expect(repeated.call.transcript.length).toBeGreaterThan(asked.call.transcript.length);
  });

});

describe("menu 3, hear the doctor's advice", () => {
  it("says there is no advice yet for a family without one", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "3", e);
    expect(after.call.state).toBe("readAdvice");
    expect(said(after.call)).toContain("There is no advice for your family yet.");
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
    const after = type(startCall(e), "4471" + "1" + "2" + "1122", e);
    expect(said(after.call)).toContain("From your answers, Arjun should see the doctor.");
    expect(said(after.call)).not.toMatch(/amber|Result:/);
    expect(said(after.call)).not.toMatch(/Result: (amber|red|green)/);
  });

  it("reads the advice date the way a person says it", () => {
    const e = env();
    const after = type(startCall(e), "2205" + "3", e);
    expect(said(after.call)).toContain("Dr. Ramesh has a message for Shobha, from yesterday.");
    expect(said(after.call)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("never dates advice in the future", () => {
    const e = env();
    const bookings = e.bookings.map((b) => (b.id === "b-3120" ? { ...b, date: isoDate(1), advice: "Keep her upright." } : b));
    const after = type(startCall({ ...e, bookings }, { familyId: "3120" }), "3", { ...e, bookings });
    expect(said(after.call)).toContain("Dr. Ramesh has a message for Kavya. | Keep her upright. | That's all from Dr. Ramesh.");
  });

  it("names each person, so two children are never confused", () => {
    const e = env();
    const twins = e.families.map((f) =>
      f.id === "4471" ? { ...f, members: [...f.members, { id: "4471-3", name: "Meena", age: 6, role: "child" as const }] } : f,
    );
    const e2 = { ...e, families: twins };
    const asked = type(startCall(e2), "4471" + "1", e2);
    expect(said(asked.call)).toContain("Who needs help? Press 1 for Lakshmi. Press 2 for Arjun. Press 3 for Meena.");
    const meena = type(asked, "3", e2);
    expect(meena.call.memberId).toBe("4471-3");
    expect(said(meena.call)).toContain("Checking for Meena, 6.");
  });

  it("a key with nobody behind it asks again", () => {
    const e = env();
    const after = type(startCall(e), "3120" + "1" + "3", e);
    expect(after.call.state).toBe("whoIsUnwell");
    expect(said(after.call)).toContain("Sorry, I did not understand that.");
  });

  it("advice belongs to a person: with two, the caller chooses by name", () => {
    const e = env();
    const kavya = { ...e.bookings[0], id: "b-k", date: isoDate(0), advice: "Steam twice a day." };
    const dad = { ...e.concerns[0], id: "c-dad", memberId: "3120-1" };
    const dadBooking = { ...e.bookings[0], id: "b-d", concernId: "c-dad", date: isoDate(0), advice: "Rest for two days." };
    const e2 = { ...e, concerns: [...e.concerns, dad], bookings: [kavya, dadBooking, ...e.bookings.slice(1)] };
    const menu = type(startCall(e2, { familyId: "3120" }), "3", e2);
    expect(menu.call.state).toBe("chooseAdvice");
    expect(said(menu.call)).toContain("Whose advice would you like to hear?");
    const heard = type(menu, "2", e2);
    const names = said(menu.call).match(/Press 2 for (\w+)/)![1];
    expect(said(heard.call)).toContain(`Dr. Ramesh has a message for ${names}`);
    expect(said(heard.call)).toContain(names === "Kavya" ? "Steam twice a day." : "Rest for two days.");
  });

  it("home-care advice from an older record without its spoken form still plays", () => {
    const e = env();
    const green = { ...e.concerns[0], id: "c-g", familyId: "4471", memberId: "4471-2", urgency: "green" as const, homeCare: { tell: ["x"], callIf: ["y"] } };
    const e2 = { ...e, concerns: [...e.concerns, green] };
    const heard = type(startCall(e2, { familyId: "4471" }), "3", e2);
    expect(said(heard.call)).toContain("Here is the advice from Arjun's check today. | At home, give small sips");
  });

  it("the end of a call says goodbye and nothing more", () => {
    const e = env();
    const done = type(startCall(e), "4471" + "1" + "2" + "1122" + "11", e);
    expect(done.call.state).toBe("ended");
    expect(done.call.transcript.at(-1)?.text).toBe("Thank you for calling Arogya Line. Goodbye.");
    expect(said(done.call)).not.toContain("Hang up");
  });

  it("books exactly the slot it offered", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "2" + "1122", e);
    const { offerDate, offerSlot } = offered.call;
    const booked = type(offered, "11", e);
    const book = booked.effects.find((x) => x.type === "book");
    expect(book).toMatchObject({ date: offerDate, slot: offerSlot });
  });

  it("says so, and offers another, when the offered slot is taken meanwhile", () => {
    const e = env();
    const offered = type(startCall(e), "4471" + "1" + "2" + "1122", e);
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

  it("an emergency is come now, not an appointment: no slot is booked", () => {
    const e = { ...env(), hour: 22 };
    let step = startCall(e, { familyId: "3120", emergency: true });
    step = tick(step.call, e);
    step = tick(step.call, e);
    expect(said(step.call)).toContain("Please bring the patient to PHC Tumkur now. You will be seen as an emergency");
    expect(said(step.call)).not.toMatch(/also booked|next available/);
    expect(step.effects).toEqual([expect.objectContaining({ type: "emergency", concern: expect.objectContaining({ urgency: "red" }) })]);
  });

  it("says back what the caller reported, as speech, not a list", () => {
    const e = env();
    const after = type(startCall(e), "4471" + "1" + "2" + "1122", e);
    expect(said(after.call)).toContain("You told us about fever more than 2 days and vomiting more than 3 times today. You did not report fast breathing.");
    expect(said(after.call)).not.toContain("Noted:");
  });

  it("replays the advice exactly as it was given, from the record", () => {
    const e = env();
    const given = { tell: ["x"], callIf: ["y"], spoken: ["At home, rest in the shade.", "Call us again if it gets worse."] };
    const green = { ...e.concerns[0], id: "c-g", familyId: "4471", memberId: "4471-2", urgency: "green" as const, homeCare: given };
    const e2 = { ...e, concerns: [...e.concerns, green] };
    const heard = type(startCall(e2, { familyId: "4471" }), "3", e2);
    expect(said(heard.call)).toContain("At home, rest in the shade. | Call us again if it gets worse.");
  });

  it("after advice, 1 hears it again and 2 goes back to the menu", () => {
    const e = env();
    const heard = type(startCall(e, { familyId: "2205" }), "3", e);
    const again = type(heard, "1", e);
    expect(said(again.call).split("Take the iron tablet").length - 1).toBe(2);
    expect(type(heard, "2", e).call.state).toBe("mainMenu");
  });

});


describe("0 is a person, never a booking", () => {
  /** Press keys, then let the health worker speak until they stop. */
  function toPerson(keys: string, e: Env, opts = {}) {
    let step = type(startCall(e, opts), keys, e);
    const effects = [...step.effects];
    for (let i = 0; i < 4 && step.call.state === "operator"; i++) {
      step = tick(step.call, e);
      effects.push(...step.effects);
    }
    return { call: step.call, effects };
  }

  it("from the main menu: the health worker asks how to help, and nothing is recorded", () => {
    const e = env();
    const { call, effects } = toPerson("4471" + "0", e);
    expect(effects).toEqual([]);
    expect(call.state).toBe("operator");
    expect(said(call)).toContain("How can I help you today?");
    expect(said(call)).not.toMatch(/booked|next available|Lakshmi's answers/);
  });

  it("after a home-care result: no urgent signs stays no urgent signs, no visit appears", () => {
    const e = env();
    const { call, effects } = toPerson("4471" + "1" + "2" + "2222" + "0", e);
    expect(effects.filter((x) => x.type !== "concern")).toEqual([]); // only the check itself was saved
    expect(said(call)).toContain("I have Arjun's answers from the call. The check found no urgent signs.");
  });

  it("while hearing advice: a person, not an appointment", () => {
    const e = env();
    const { effects } = toPerson("2205" + "3" + "0", e);
    expect(effects).toEqual([]);
  });

  it("halfway through the questions: said to be unfinished, never treated as a referral", () => {
    const e = env();
    const { call, effects } = toPerson("4471" + "1" + "2" + "11" + "0", e);
    expect(effects).toEqual([]);
    expect(said(call)).toContain("I can see you started a health check for Arjun. I'll help you from here");
  });
});

describe("failure modes", () => {
  it("never invents a slot when the diary is full", () => {
    const e = env();
    const full = [];
    for (let d = 0; d < 40; d++)
      for (const slot of ["09:00–10:00", "10:00–11:00", "11:00–12:00", "14:00–15:00"]) full.push({ ...e.bookings[0], id: `f${d}${slot}`, date: isoDate(d), slot });
    const e2 = { ...e, bookings: full };
    const after = type(startCall(e2), "4471" + "1" + "2" + "1122", e2);
    expect(said(after.call)).toContain("There are no appointments free in the next 30 days.");
    expect(after.call.offerSlot).toBeNull();
    expect(type(after, "1", e2).effects).toEqual([]);
  });

  it("a big family is read in pages, so nobody is left out", () => {
    const e = env();
    const members = Array.from({ length: 10 }, (_, i) => ({ id: `big-${i}`, name: `Person${i + 1}`, age: 30, role: "adult" as const }));
    const e2 = { ...e, families: [...e.families, { ...e.families[0], id: "9000", members }] };
    const asked = type(startCall(e2), "9000" + "1", e2);
    expect(said(asked.call)).toContain("Press 7 for Person7. Press 8 for more names.");
    const more = type(asked, "8", e2);
    expect(said(more.call)).toContain("Press 3 for Person10.");
    expect(type(more, "3", e2).call.memberId).toBe("big-9");
  });

  it("a card with nobody on it says so and offers a person", () => {
    const e = env();
    const e2 = { ...e, families: [...e.families, { ...e.families[0], id: "9001", members: [] }] };
    const asked = type(startCall(e2), "9001" + "1", e2);
    expect(said(asked.call)).toContain("There is no one registered on this family card. | Press 0 to talk to a health worker.");
  });
});
