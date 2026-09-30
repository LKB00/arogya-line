// Voice line call state machine (SPEC 6.2). Pure functions only: given the
// current call, a key press (or a control), and a read-only view of the store,
// return the next call plus the store writes to perform. CallSimulator.tsx
// owns the React state and runs the writes through store actions, so this
// file never touches the store itself.
//
// Triage comes from src/app/triage.ts, the same functions the ASHA app uses.

import { ASHA, PHC, SLOTS, addDays } from "../../app/seed";
import type { ConcernInput } from "../../app/store";
import { adviceByPerson, type PersonAdvice } from "../../app/store";
import { isBookable, slotTaken } from "../../app/slots";
import { HOME_CARE, evaluate, getQuestions, homeCareFor, nextQuestion, toTriageRole, type TriageResult, type TriageRole } from "../../app/triage";
import type { Booking, Concern, Family, Member, TriageAnswer, Urgency } from "../../app/types";
import { dayLabel, shortDate, slotLabel } from "../../app/format";

export type CallState =
  | "idle"
  | "enterFamilyId"
  | "mainMenu"
  | "whoIsUnwell"
  | "triageQuestion"
  | "resultGreen"
  | "resultAmber"
  | "offerBooking"
  | "confirmBooking"
  | "resultRed"
  | "operator"
  | "chooseAdvice"
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
  /** The exact slot spoken in offerBooking, so confirming books what was offered. */
  offerSlot: string | null;
  /** How far the scripted operator exchange has got (advanced by tick). */
  operatorStep: number;
  /** Which page of names is being read, when a list is longer than the keys. */
  page: number;
};

/** Read-only slice of the store the machine needs. */
export type Env = {
  families: Family[];
  concerns: Concern[];
  bookings: Booking[];
  today: string;
  /** The hour now (0–23), so slots already started today are never offered. Defaults to the clock. */
  hour?: number;
};

/** Store writes for CallSimulator to run. "book" creates the concern and a booking on it. */
export type Effect =
  | { type: "concern"; concern: ConcernInput }
  | { type: "book"; concern: ConcernInput; date: string; slot: string }
  /** Coming to the PHC now: an emergency arrival, never an appointment slot. */
  | { type: "emergency"; concern: ConcernInput };

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
  offerSlot: null,
  operatorStep: 0,
  page: 0,
};

export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
export type Key = (typeof KEYS)[number];

// ---- Spoken text ---------------------------------------------------------

const WELCOME = "Welcome to Arogya Line.";
const ASK_ID = "Please enter your 4-digit family ID. It is printed on your family card.";
const MENU =
  "Main menu. Press 1 if someone is unwell and you want to know if it is serious. " +
  "Press 2 to book a visit. Press 3 to hear your advice. Press 0 to talk to a person.";
const YES_NO = "Press 1 for yes, 2 for no, or 9 to hear the question again.";
const NOT_UNDERSTOOD = "Sorry, I did not understand that.";
const GOODBYE = "Thank you for calling Arogya Line. Goodbye.";

/** The result as a person says it on the phone: from the answers, never a verdict or a code. */
const RESULT_HEADLINE: Record<Urgency, (who: string) => string> = {
  green: (who) => `Thank you. From your answers, there are no urgent signs for ${who}.`,
  amber: (who) => `Thank you. From your answers, ${who} should see the doctor.`,
  red: (who) => `From your answers, ${who} needs the PHC now.`,
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

/** The person the caller chose, and only them: never a guess such as the family head. */
function memberOf(call: Call, env: Env): Member | undefined {
  return familyOf(call, env)?.members.find((m) => m.id === call.memberId);
}

/**
 * "Press 1 for Pooja. Press 2 for Arjun." The caller picks the person by
 * name, never a kind of person: a family can have two children. Keys 1–8,
 * as 9 repeats and 0 reaches a person. A list longer than eight is read in
 * pages of seven, with 8 for more, so nobody is silently left out.
 */
const PAGE_SIZE = 7;

function pageOf<T>(items: T[], page: number): { shown: T[]; paged: boolean } {
  if (items.length <= 8) return { shown: items, paged: false };
  return { shown: items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), paged: true };
}

function nextPage(length: number, page: number): number {
  return (page + 1) * PAGE_SIZE >= length ? 0 : page + 1;
}

function namesPrompt(names: string[], page: number): string {
  const { shown, paged } = pageOf(names, page);
  const said = shown.map((name, i) => `Press ${i + 1} for ${name}.`).join(" ");
  return paged ? `${said} Press 8 for more names.` : said;
}

function pickByKey<T>(items: T[], key: Key, page: number): T | "more" | undefined {
  const { shown, paged } = pageOf(items, page);
  if (paged && key === "8") return "more";
  const n = Number(key);
  return n >= 1 && n <= shown.length ? shown[n - 1] : undefined;
}

function hourOf(env: Env): number {
  return env.hour ?? new Date().getHours();
}

/** First slot on `date` that nobody holds and, today, that has not started. */
function freeSlot(env: Env, date: string): string | undefined {
  return SLOTS.find((s) => isBookable(env.bookings, date, s, env.today, hourOf(env)));
}

/** How far ahead the line looks for a free slot. */
export const SEARCH_DAYS = 30;

/** First day on or after `from` with a free slot, or nothing: never an invented one. */
function nextAvailable(env: Env, from: string): { date: string; slot: string } | undefined {
  let date = from;
  for (let i = 0; i < SEARCH_DAYS; i++) {
    const slot = freeSlot(env, date);
    if (slot) return { date, slot };
    date = addDays(date, 1);
  }
  return undefined;
}

/** ["fever", "vomiting"] → "fever and vomiting"; three or more take commas. */
function spokenList(items: string[], joiner: "and" | "or"): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${joiner} ${items.at(-1)}` : (items[0] ?? "");
}

/**
 * What the caller told the line, said back the way a person would: what they
 * reported, then the danger sign they did not. Never a written list read out.
 */
function heardLine(role: TriageRole, answers: TriageAnswer[]): string {
  const lower = (t: string) => t[0].toLowerCase() + t.slice(1);
  const yes = getQuestions(role).filter((q) => answers.some((a) => a.questionId === q.id && a.answer === "yes"));
  const clear = getQuestions(role).filter((q) => q.dangerSign && q.notFound && answers.some((a) => a.questionId === q.id && a.answer === "no"));
  const told = yes.length ? `You told us about ${spokenList(yes.map((q) => lower(q.label)), "and")}.` : "You did not report any of the signs I asked about.";
  const notReported = clear.map((q) => `You did not report ${lower((q.notFound ?? "").replace(/^No /, ""))}.`);
  return [told, ...notReported].join(" ");
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

function enterWhoIsUnwell(call: Call, env: Env, page = 0): Call {
  const people = familyOf(call, env)?.members ?? [];
  // A card with nobody on it: say so and offer a person, never a menu of nothing.
  if (people.length === 0) {
    return prompt({ ...call, state: "whoIsUnwell", page: 0 }, "There is no one registered on this family card.", "Press 0 to talk to a health worker.");
  }
  return prompt({ ...call, state: "whoIsUnwell", page }, `Who needs help? ${namesPrompt(people.map((m) => m.name), page)}`);
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
  // Spoken in words the caller knows, never the internal colour name.
  const headline = RESULT_HEADLINE[result.urgency](who);
  const withResult = { ...call, result };

  if (result.urgency === "green") {
    // The concern this saves puts a follow-up on the ASHA's list, so the line
    // promises only that: she has been told and will follow up.
    const next = prompt(
      { ...withResult, state: "resultGreen" },
      headline,
      heardLine(call.role, call.answers),
      ...HOME_CARE[call.role].spoken,
      `Your ASHA, ${ASHA.name}, has been told and will follow up with you.`,
      "Press 9 to hear this again, or hang up.",
    );
    const concern = { ...concernFor(next, env, "green"), homeCare: homeCareFor(call.role) };
    return { call: next, effects: [{ type: "concern", concern }] };
  }

  if (result.urgency === "amber") {
    const spoken = say({ ...withResult, state: "resultAmber" }, "line", headline, heardLine(call.role, call.answers));
    return { call: offerSlot(spoken, env, addDays(env.today, 1)), effects: [] };
  }

  const spoken = say({ ...withResult, state: "resultRed" }, "line", headline, heardLine(call.role, call.answers));
  return { call: enterOperator(spoken), effects: [] };
}

function offerSlot(call: Call, env: Env, from: string): Call {
  const found = nextAvailable(env, from);
  if (!found) {
    return prompt(
      { ...call, state: "offerBooking", offerDate: null, offerSlot: null },
      `There are no appointments free in the next ${SEARCH_DAYS} days.`,
      "Press 0 to talk to a health worker, or hang up and try again later.",
    );
  }
  const { date, slot } = found;
  const when = dayWord(date, env.today);
  const text =
    `The next available slot is ${when === "on" ? "on " : `${when}, `}${shortDate(date)}, ${slotLabel(slot)}, ` +
    `at ${PHC.facility} with ${PHC.doctor}. Press 1 to book it, or 2 for another day.`;
  return prompt({ ...call, state: "offerBooking", offerDate: date, offerSlot: slot }, text);
}

/** Read the choice back before anything is booked: who, when, where. */
function confirmBooking(call: Call, env: Env): Call {
  const member = memberOf(call, env);
  const date = call.offerDate ?? env.today;
  const when = dayWord(date, env.today);
  const text =
    `You are booking a visit for ${member?.name ?? "the patient"}, ${when === "on" ? "on " : `${when}, `}${shortDate(date)}, ` +
    `${slotLabel(call.offerSlot ?? "")}, at ${PHC.facility}. Press 1 to confirm, or 2 to choose another day.`;
  return prompt({ ...call, state: "confirmBooking" }, text);
}

function enterOperator(call: Call): Call {
  const text = call.emergency
    ? "Emergency. Connecting you to the health worker on duty now. Please hold."
    : "Please hold. Connecting you to the health worker on duty.";
  return prompt({ ...call, state: "operator", operatorStep: 0 }, text);
}

/**
 * One person's advice, said the way a person would: who it is from and for,
 * the words, then a clear end, so the caller knows the message is over.
 */
function adviceLines(a: PersonAdvice, env: Env, member: Member | undefined): string[] {
  const name = member?.name ?? "you";
  if (a.from === "doctor" && a.booking) {
    // The day as a person says it ("yesterday", "Fri 25 Sep"), never ISO, and
    // never a day still to come: advice written ahead of a visit has no "when".
    const when = a.date <= env.today ? `, from ${dayLabel(a.date).toLowerCase()}` : "";
    return [`${a.booking.doctor} has a message for ${name}${when}.`, a.booking.advice ?? "", `That's all from ${a.booking.doctor}.`];
  }
  const role = member ? toTriageRole(member.role) : "adult";
  // Exactly what was said at the time, from the record; the protocol's
  // current wording only if an older record has no spoken form.
  const words = a.concern?.homeCare?.spoken ?? HOME_CARE[role].spoken;
  return [`Here is the advice from ${name}'s check ${dayLabel(a.date).toLowerCase()}.`, ...words, "That's all."];
}

const AFTER_ADVICE = "Press 1 to hear it again, or 2 for the main menu.";

function readAdvice(call: Call, env: Env, a: PersonAdvice): Call {
  const member = familyOf(call, env)?.members.find((m) => m.id === a.memberId);
  return prompt({ ...call, state: "readAdvice" }, ...adviceLines(a, env, member), AFTER_ADVICE);
}

/** Advice is a person's: one person is read at once, several are chosen by name. */
function enterReadAdvice(call: Call, env: Env): Call {
  const advice = call.familyId ? adviceByPerson(env, call.familyId) : [];
  if (advice.length === 0) {
    return prompt({ ...call, state: "readAdvice" }, "There is no advice for your family yet.", "Press 2 for the main menu, or hang up.");
  }
  if (advice.length === 1) return readAdvice(call, env, advice[0]);
  return enterChooseAdvice(call, env, advice, 0);
}

function enterChooseAdvice(call: Call, env: Env, advice: PersonAdvice[], page: number): Call {
  const names = advice.map((a) => familyOf(call, env)?.members.find((m) => m.id === a.memberId)?.name ?? "someone");
  return prompt({ ...call, state: "chooseAdvice", page }, `Whose advice would you like to hear? ${namesPrompt(names, page)}`);
}

function end(call: Call, ...texts: string[]): Call {
  return prompt({ ...call, state: "ended" }, ...texts, GOODBYE);
}

/** Look the family up; on success go to the menu (or straight to the operator in emergency mode). */
function connectFamily(call: Call, familyId: string, env: Env): Call {
  const family = env.families.find((f) => f.id === familyId);
  if (!family) {
    return enterFamilyId(say(call, "line", `Sorry, family ID ${familyId} was not found.`));
  }
  // Nothing identifying is said aloud on a card number alone (a shared phone,
  // a crowded room, a found card): no name, no village. A real service would
  // verify the caller before reading any name or advice.
  const connected = say({ ...call, familyId }, "line", "Thank you. We have found your family card.");
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
      if (key === "1") return none(enterWhoIsUnwell(pressed, env));
      if (key === "2") {
        return none(
          enterWhoIsUnwell(say(pressed, "line", "To book a visit, I will first ask a few questions so the doctor knows what to expect."), env),
        );
      }
      if (key === "3") return none(enterReadAdvice(pressed, env));
      break;

    case "whoIsUnwell": {
      const members = familyOf(pressed, env)?.members ?? [];
      const member = pickByKey(members, key, pressed.page);
      if (member === "more") return none(enterWhoIsUnwell(pressed, env, nextPage(members.length, pressed.page)));
      if (member) {
        const role = toTriageRole(member.role);
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

    case "offerBooking":
      // 1 chooses the slot; nothing is booked until the caller confirms it.
      if (key === "1" && pressed.offerDate && pressed.offerSlot) return none(confirmBooking(pressed, env));
      if (key === "2" && pressed.offerDate) return none(offerSlot(pressed, env, addDays(pressed.offerDate, 1)));
      break;

    case "confirmBooking": {
      if (key === "1" && pressed.offerDate && pressed.offerSlot) {
        const date = pressed.offerDate;
        const slot = pressed.offerSlot;
        // Checked again at the moment of confirming, with the same rule used
        // to offer it: taken while the caller listened, or its hour started
        // (offered at 9:58, confirmed at 10:02). Say which, and offer the next
        // one; never book a different slot than the one spoken.
        if (!isBookable(env.bookings, date, slot, env.today, hourOf(env))) {
          const why = slotTaken(env.bookings, date, slot) ? "Sorry, that slot has just been taken." : "Sorry, that time has just started, so it can no longer be booked.";
          return none(offerSlot(say(pressed, "line", why), env, date));
        }
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

    case "chooseAdvice": {
      const advice = pressed.familyId ? adviceByPerson(env, pressed.familyId) : [];
      const chosen = pickByKey(advice, key, pressed.page);
      if (chosen === "more") return none(enterChooseAdvice(pressed, env, advice, nextPage(advice.length, pressed.page)));
      if (chosen) return none(readAdvice(pressed, env, chosen));
      break;
    }

    case "readAdvice":
      if (key === "1") return none(say(pressed, "line", ...call.lastPrompt));
      if (key === "2") return none(enterMainMenu(pressed));
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
  // The health worker sees the record; they do not read the household out.
  const record = family ? "your family's record" : "your call";
  const urgent = call.emergency || call.result?.urgency === "red";

  if (call.operatorStep === 0) {
    const text = call.emergency
      ? `Namaste, Arogya Line. I have your emergency call and ${record} in front of me. I am alerting ${PHC.doctor} at ${PHC.facility} and your ASHA, ${ASHA.name}.`
      : urgent
        ? `Namaste, Arogya Line. I have ${record} in front of me. From the answers, this is urgent.`
        : `Namaste, Arogya Line. I have ${record} in front of me.`;
    return { call: { ...say(call, "operator", text, ...handOffLines(call, member)), operatorStep: 1 }, effects: [] };
  }

  // Not urgent: 0 means "a person", nothing more. The health worker asks how
  // to help, and the conversation is theirs: no booking, no record, no
  // referral is made on the caller's behalf from a key press.
  if (!urgent) {
    if (call.operatorStep > 1) return { call, effects: [] };
    return { call: { ...say(call, "operator", "How can I help you today?"), operatorStep: 2 }, effects: [] };
  }

  // An emergency is not an appointment: come now, the PHC and the ASHA are
  // told, and the PHC expects an emergency arrival today. No slot is booked.
  // Only the person the caller actually chose is named.
  const name = member?.name ?? "the patient";
  // Emergency mode is only ever opened by the ASHA's "Call PHC now": the
  // record says so, so the doctor never reads it as a family's own call.
  const concern = { ...concernFor(call, env, "red", call.emergency ? "Emergency call from the ASHA app" : undefined), ...(call.emergency ? { initiatedBy: "asha" as const } : {}) };
  const done = end(
    say(
      call,
      "operator",
      `Please bring ${name} to ${PHC.facility} now. You will be seen as an emergency; there is no need to wait for a time.`,
      `${PHC.doctor} is expecting ${name}, and your ASHA, ${ASHA.name}, has been told.`,
    ),
  );
  return { call: done, effects: [{ type: "emergency", concern }] };
}

/**
 * What the health worker already knows when they pick up, said so the caller
 * never starts from zero: a finished check and its result, or a check that
 * was started and not finished (never treated as finished).
 */
function handOffLines(call: Call, member: Member | undefined): string[] {
  if (!member || !call.role || call.answers.length === 0) return [];
  if (!call.result) return [`I can see you started a health check for ${member.name}. I'll help you from here, so you won't need to start again.`];
  const summary = {
    green: "The check found no urgent signs.",
    amber: "The check suggested a visit to the doctor.",
    red: "The check found a danger sign.",
  }[call.result.urgency];
  return [`I have ${member.name}'s answers from the call. ${summary} You won't need to repeat them.`];
}
