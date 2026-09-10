// Voice line call state machine (SPEC 6.2). Pure functions only: given the
// current call, a key press (or a control), and a read-only view of the store,
// return the next call plus the store writes to perform. CallSimulator.tsx
// owns the React state and runs the writes through store actions, so this
// file never touches the store itself.
//
// Triage comes from src/app/triage.ts, the same functions the ASHA app uses.

import { ASHA, PHC, SLOTS, addDays } from "../../app/seed";
import type { ConcernInput } from "../../app/store";
import { latestAdviceFor } from "../../app/store";
import { evaluate, nextQuestion, toTriageRole, type TriageResult, type TriageRole } from "../../app/triage";
import type { Booking, Concern, Family, Member, TriageAnswer, Urgency } from "../../app/types";
import { shortDate, slotLabel } from "../../app/format";

export type CallState =
  | "idle"
  | "enterFamilyId"
  | "mainMenu"
  | "whoIsUnwell"
  | "triageQuestion"
  | "resultGreen"
  | "resultAmber"
  | "offerBooking"
  | "resultRed"
  | "operator"
  | "readAdvice"
  | "ended";

export type Speaker = "line" | "caller" | "operator";
export type Line = { speaker: Speaker; text: string };

export type Call = {
  state: CallState;
  transcript: Line[];
  /** Spoken lines that key 9 repeats. */
  lastPrompt: string[];
  familyId: string | null;
  /** Digits typed so far while in enterFamilyId. */
  idBuffer: string;
  /** Came from the ASHA app's "Call PHC now": go straight to the operator. */
  emergency: boolean;
  role: TriageRole | null;
  memberId: string | null;
  answers: TriageAnswer[];
  result: TriageResult | null;
  /** Date currently offered in offerBooking. */
  offerDate: string | null;
  /** How far the scripted operator exchange has got (advanced by tick). */
  operatorStep: number;
};

/** Read-only slice of the store the machine needs. */
export type Env = { families: Family[]; concerns: Concern[]; bookings: Booking[]; today: string };

/** Store writes for CallSimulator to run. "book" creates the concern and a booking on it. */
export type Effect =
  | { type: "concern"; concern: ConcernInput }
  | { type: "book"; concern: ConcernInput; date: string; slot: string };

export type Step = { call: Call; effects: Effect[] };

export type StartOptions = {
  familyId?: string | null;
  emergency?: boolean;
  /** Optional member + answers handed over by the ASHA app in emergency mode. */
  memberId?: string | null;
  answers?: TriageAnswer[];
};

export const IDLE: Call = {
  state: "idle",
  transcript: [],
  lastPrompt: [],
  familyId: null,
  idBuffer: "",
  emergency: false,
  role: null,
  memberId: null,
  answers: [],
  result: null,
  offerDate: null,
  operatorStep: 0,
};

export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
export type Key = (typeof KEYS)[number];

// ---- Spoken text ---------------------------------------------------------

const WELCOME = "Welcome to Arogya Line.";
const ASK_ID = "Please enter your 4-digit family ID. It is printed on your family card.";
const MENU =
  "Main menu. Press 1 if someone is unwell and you want to know if it is serious. " +
  "Press 2 to book a visit. Press 3 to hear your doctor's advice. Press 0 to talk to a person.";
const WHO = "Who is unwell? Press 1 for a child, 2 for an adult, 3 for a pregnant woman.";
const YES_NO = "Press 1 for yes, 2 for no, or 9 to hear the question again.";
const NOT_UNDERSTOOD = "Sorry, I did not understand that.";
const GOODBYE = "Thank you for calling Arogya Line. Goodbye.";

const HOME_CARE: Record<TriageRole, string> = {
  child: "Give small sips of fluid often, keep the child cool and lightly dressed, and keep feeding as usual.",
  adult: "Rest, drink plenty of water, and take paracetamol if the fever is high.",
  pregnant: "Rest lying on your left side, drink plenty of water, and keep taking your iron tablets.",
};

const RESULT_HEADLINE: Record<Urgency, string> = {
  green: "Care at home.",
  amber: "Should see the doctor.",
  red: "Needs the PHC now.",
};

function dayWord(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date === addDays(today, 2)) return "the day after tomorrow";
  return "on";
}

// ---- Small helpers -------------------------------------------------------

function say(call: Call, speaker: Speaker, ...texts: string[]): Call {
  return { ...call, transcript: [...call.transcript, ...texts.map((text) => ({ speaker, text }))] };
}

/** Speak a prompt and remember it for key 9. */
function prompt(call: Call, ...texts: string[]): Call {
  return { ...say(call, "line", ...texts), lastPrompt: texts };
}

function familyOf(call: Call, env: Env): Family | undefined {
  return env.families.find((f) => f.id === call.familyId);
}

function memberOf(call: Call, env: Env): Member | undefined {
  const family = familyOf(call, env);
  return family?.members.find((m) => m.id === call.memberId) ?? family?.members[0];
}

/** The family member the caller most likely means; the head of family if none fits. */
function memberForRole(family: Family, role: TriageRole): Member {
  return family.members.find((m) => toTriageRole(m.role) === role) ?? family.members[0];
}

function freeSlot(bookings: Booking[], date: string): string | undefined {
  const taken = new Set(bookings.filter((b) => b.date === date).map((b) => b.slot));
  return SLOTS.find((s) => !taken.has(s));
}

/** First day on or after `from` with a free slot. */
function nextAvailable(env: Env, from: string): { date: string; slot: string } {
  let date = from;
  for (let i = 0; i < 30; i++) {
    const slot = freeSlot(env.bookings, date);
    if (slot) return { date, slot };
    date = addDays(date, 1);
  }
  return { date: from, slot: SLOTS[SLOTS.length - 1] };
}

/** Same-day slot for the operator; the last slot is reused when the day is full. */
function sameDaySlot(env: Env): string {
  return freeSlot(env.bookings, env.today) ?? SLOTS[SLOTS.length - 1];
}

function reasonsLine(reasons: string[]): string {
  return reasons.length ? `Noted: ${reasons.join("; ")}.` : "Nothing specific was noted.";
}

/** Build the concern for whatever the call has gathered so far. */
function concernFor(call: Call, env: Env, urgency: Urgency, extraReason?: string): ConcernInput {
  const family = familyOf(call, env);
  const member = memberOf(call, env);
  const reasons = call.result?.reasons ?? (call.role ? evaluate(call.role, call.answers).reasons : []);
  return {
    familyId: family?.id ?? call.familyId ?? "",
    memberId: member?.id ?? "",
    source: "ivr",
    answers: call.answers,
    urgency,
    reasons: extraReason ? [...reasons, extraReason] : reasons,
  };
}

// ---- Entering states -----------------------------------------------------

function enterFamilyId(call: Call): Call {
  return prompt({ ...call, state: "enterFamilyId", idBuffer: "" }, ASK_ID);
}

function enterMainMenu(call: Call): Call {
  return prompt({ ...call, state: "mainMenu", role: null, memberId: null, answers: [], result: null, offerDate: null }, MENU);
}

function enterWhoIsUnwell(call: Call): Call {
  return prompt({ ...call, state: "whoIsUnwell" }, WHO);
}

function askQuestion(call: Call): Call {
  const q = call.role ? nextQuestion(call.role, call.answers) : null;
  if (!q) return call;
  const n = call.answers.length + 1;
  return prompt({ ...call, state: "triageQuestion" }, `Question ${n}. ${q.text}`, YES_NO);
}

function enterResult(call: Call, env: Env): Step {
  if (!call.role) return { call, effects: [] };
  const result = evaluate(call.role, call.answers);
  const member = memberOf(call, env);
  const who = member ? `${member.name}` : "The patient";
  const headline = `Result: ${result.urgency}. ${who}: ${RESULT_HEADLINE[result.urgency]}`;
  const withResult = { ...call, result };

  if (result.urgency === "green") {
    const next = prompt(
      { ...withResult, state: "resultGreen" },
      headline,
      reasonsLine(result.reasons),
      HOME_CARE[call.role],
      "Call again if a new sign appears.",
      "Your ASHA will visit tomorrow.",
      "Press 9 to hear this again, or hang up.",
    );
    return { call: next, effects: [{ type: "concern", concern: concernFor(next, env, "green") }] };
  }

  if (result.urgency === "amber") {
    const spoken = say({ ...withResult, state: "resultAmber" }, "line", headline, reasonsLine(result.reasons));
    return { call: offerSlot(spoken, env, addDays(env.today, 1)), effects: [] };
  }

  const spoken = say({ ...withResult, state: "resultRed" }, "line", headline, reasonsLine(result.reasons));
  return { call: enterOperator(spoken), effects: [] };
}

function offerSlot(call: Call, env: Env, from: string): Call {
  const { date, slot } = nextAvailable(env, from);
  const when = dayWord(date, env.today);
  const text =
    `The next available slot is ${when === "on" ? "on " : `${when}, `}${shortDate(date)}, ${slotLabel(slot)}, ` +
    `at ${PHC.facility} with ${PHC.doctor}. Press 1 to book it, or 2 for another day.`;
  return prompt({ ...call, state: "offerBooking", offerDate: date }, text);
}

function enterOperator(call: Call): Call {
  const text = call.emergency
    ? "Emergency. Connecting you to the health worker on duty now. Please hold."
    : "Please hold. Connecting you to the health worker on duty.";
  return prompt({ ...call, state: "operator", operatorStep: 0 }, text);
}

function enterReadAdvice(call: Call, env: Env): Call {
  const advice = call.familyId ? latestAdviceFor(env, call.familyId) : undefined;
  const text = advice ? `Your doctor's advice from ${advice.doctor}, ${advice.date}: ${advice.advice}` : "No advice yet.";
  return prompt({ ...call, state: "readAdvice" }, text, "Press 1 for the main menu, 9 to hear this again, or hang up.");
}

function end(call: Call, ...texts: string[]): Call {
  return prompt({ ...call, state: "ended" }, ...texts, GOODBYE, "Hang up to finish.");
}

/** Look the family up; on success go to the menu (or straight to the operator in emergency mode). */
function connectFamily(call: Call, familyId: string, env: Env): Call {
  const family = env.families.find((f) => f.id === familyId);
  if (!family) {
    return enterFamilyId(say(call, "line", `Sorry, family ID ${familyId} was not found.`));
  }
  const connected = say({ ...call, familyId }, "line", `Family ${family.id}, ${family.head}, ${family.village}.`);
  return call.emergency ? enterOperator(connected) : enterMainMenu(connected);
}

// ---- Public transitions --------------------------------------------------

/** Press Call. Family ID / mode from the URL skip straight to the right state. */
export function startCall(env: Env, options: StartOptions = {}): Step {
  const family = env.families.find((f) => f.id === options.familyId);
  const member = family?.members.find((m) => m.id === options.memberId);
  let call: Call = {
    ...IDLE,
    emergency: options.emergency ?? false,
    memberId: member?.id ?? null,
    role: member ? toTriageRole(member.role) : null,
    answers: member ? (options.answers ?? []) : [],
  };
  call = say(call, "caller", "Dialling Arogya Line…");
  call = say(call, "line", WELCOME);
  call = options.familyId ? connectFamily(call, options.familyId, env) : enterFamilyId(call);
  return { call, effects: [] };
}

/** Press Hang up: back to idle with an empty transcript. */
export function hangUp(): Step {
  return { call: IDLE, effects: [] };
}

/** Press a keypad digit. */
export function press(call: Call, key: Key, env: Env): Step {
  const none = (c: Call): Step => ({ call: c, effects: [] });

  switch (call.state) {
    case "idle":
    case "operator":
      return none(call); // nobody is listening for keys

    case "enterFamilyId": {
      // Every digit is part of the ID here, so 0 and 9 are not commands.
      const idBuffer = call.idBuffer + key;
      if (idBuffer.length < 4) return none({ ...call, idBuffer });
      const typed = say({ ...call, idBuffer: "" }, "caller", idBuffer);
      return none(connectFamily(typed, idBuffer, env));
    }

    case "ended":
      if (key === "9") return none(say(call, "line", ...call.lastPrompt));
      return none(call);
  }

  // Every other state: log the key, then 9 repeats and 0 reaches a person.
  const pressed = say(call, "caller", key);
  if (key === "9") return none(say(pressed, "line", ...call.lastPrompt));
  if (key === "0") return none(enterOperator(pressed));

  switch (call.state) {
    case "mainMenu":
      if (key === "1") return none(enterWhoIsUnwell(pressed));
      if (key === "2") {
        return none(
          enterWhoIsUnwell(say(pressed, "line", "To book a visit, I will first ask a few questions so the doctor knows what to expect.")),
        );
      }
      if (key === "3") return none(enterReadAdvice(pressed, env));
      break;

    case "whoIsUnwell": {
      const role: TriageRole | null = key === "1" ? "child" : key === "2" ? "adult" : key === "3" ? "pregnant" : null;
      const family = familyOf(pressed, env);
      if (role && family) {
        const member = memberForRole(family, role);
        const chosen = say({ ...pressed, role, memberId: member.id, answers: [] }, "line", `Checking for ${member.name}, ${member.age}.`);
        return none(askQuestion(chosen));
      }
      break;
    }

    case "triageQuestion": {
      const answer: TriageAnswer["answer"] | null = key === "1" ? "yes" : key === "2" ? "no" : null;
      const q = pressed.role ? nextQuestion(pressed.role, pressed.answers) : null;
      if (answer && q) {
        const answered = { ...pressed, answers: [...pressed.answers, { questionId: q.id, answer }] };
        const more = pressed.role && nextQuestion(pressed.role, answered.answers);
        return more ? none(askQuestion(answered)) : enterResult(answered, env);
      }
      break;
    }

    case "offerBooking": {
      if (key === "1" && pressed.offerDate) {
        const { date, slot } = nextAvailable(env, pressed.offerDate);
        const member = memberOf(pressed, env);
        const concern = concernFor(pressed, env, pressed.result?.urgency ?? "amber");
        const done = end(
          pressed,
          `Booked. ${member?.name ?? "Your visit"}, ${dayWord(date, env.today) === "on" ? "" : `${dayWord(date, env.today)}, `}${shortDate(date)}, ${slotLabel(slot)}, ${PHC.facility}, ${PHC.doctor}.`,
          `Your ASHA, ${ASHA.name}, can see this booking now.`,
        );
        return { call: done, effects: [{ type: "book", concern, date, slot }] };
      }
      if (key === "2" && pressed.offerDate) return none(offerSlot(pressed, env, addDays(pressed.offerDate, 1)));
      break;
    }

    case "readAdvice":
      if (key === "1") return none(enterMainMenu(pressed));
      break;

    case "resultGreen":
      break; // only 9 and 0 do anything here
  }

  return none(say(pressed, "line", NOT_UNDERSTOOD, ...call.lastPrompt));
}

/**
 * Advance the scripted operator exchange by one line. CallSimulator calls this
 * on a timer while the state is "operator". The final tick books the visit.
 */
export function tick(call: Call, env: Env): Step {
  if (call.state !== "operator") return { call, effects: [] };
  const family = familyOf(call, env);
  const member = memberOf(call, env);
  const who = family ? `family ${family.id}, ${family.head} in ${family.village}` : "your family";

  if (call.operatorStep === 0) {
    const text = call.emergency
      ? `Namaste, Arogya Line. I have your emergency call for ${who}. I am alerting ${PHC.doctor} at ${PHC.facility} and your ASHA, ${ASHA.name}.`
      : `Namaste, Arogya Line. I can see ${who}. Let me get you seen today.`;
    return { call: { ...say(call, "operator", text), operatorStep: 1 }, effects: [] };
  }

  const slot = sameDaySlot(env);
  const urgency: Urgency = call.emergency || call.result?.urgency === "red" ? "red" : "amber";
  const reason = call.emergency
    ? "Emergency call from the ASHA app"
    : call.result?.urgency === "red"
      ? undefined
      : "Asked to talk to a person";
  const concern = concernFor(call, env, urgency, reason);
  const done = end(
    say(
      call,
      "operator",
      `${member?.name ?? "The patient"} is booked at ${PHC.facility} today, ${shortDate(env.today)}, ${slotLabel(slot)}, with ${PHC.doctor}. ` +
        `Your ASHA, ${ASHA.name}, has been told. Please come to the PHC now.`,
    ),
  );
  return { call: done, effects: [{ type: "book", concern, date: env.today, slot }] };
}
