// Triage question tree + result logic. Shared by the ASHA app and the Voice
// line so both produce the same result for the same answers.
// Pure functions only: no React, no store access. Source: SPEC.md section 5.
//
// Illustrative questions, not clinical guidance.

import type { HomeCare, Member, TriageAnswer, Urgency } from "./types";

export const DISCLAIMER = "Illustrative questions, not clinical guidance.";

/** Number of amber "yes" answers needed for an amber result. */
export const AMBER_THRESHOLD = 2;

export type TriageRole = "child" | "adult" | "pregnant";

export type Question = {
  id: string;
  /** Spoken / displayed question. */
  text: string;
  /** Plain-text reason shown when answered "yes". */
  label: string;
  /** Plain-text line shown when a danger sign was NOT found. */
  notFound?: string;
  amberWeight: 0 | 1;
  dangerSign: boolean;
};

export type TriageResult = { urgency: Urgency; reasons: string[] };

const CHILD: Question[] = [
  {
    id: "child_fever",
    text: "Fever for more than 2 days?",
    label: "Fever more than 2 days",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "child_vomiting",
    text: "Vomiting more than 3 times today?",
    label: "Vomiting more than 3 times today",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "child_feeding",
    text: "Drinking or feeding less than usual?",
    label: "Drinking or feeding less than usual",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "child_breathing",
    text: "Breathing fast, or difficulty breathing?",
    label: "Breathing fast or difficulty breathing",
    notFound: "No fast breathing",
    amberWeight: 0,
    dangerSign: true,
  },
];

const ADULT: Question[] = [
  {
    id: "adult_fever",
    text: "Fever for more than 2 days?",
    label: "Fever more than 2 days",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "adult_pain",
    text: "Body pain or headache for more than 2 days?",
    label: "Body pain for more than 2 days",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "adult_weakness",
    text: "Too weak to do daily work?",
    label: "Too weak for daily work",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "adult_chest",
    text: "Chest pain, or breathless while resting?",
    label: "Chest pain or breathlessness at rest",
    notFound: "No chest pain or breathlessness",
    amberWeight: 0,
    dangerSign: true,
  },
];

const PREGNANT: Question[] = [
  {
    id: "pregnant_headache",
    text: "Severe headache or blurred vision?",
    label: "Severe headache or blurred vision",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "pregnant_swelling",
    text: "Swelling of the face or hands?",
    label: "Swelling of face or hands",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "pregnant_movement",
    text: "Is the baby moving less than usual?",
    label: "Baby moving less than usual",
    amberWeight: 1,
    dangerSign: false,
  },
  {
    id: "pregnant_bleeding",
    text: "Any bleeding, or waters broken before 9 months?",
    label: "Bleeding or waters broken early",
    notFound: "No bleeding",
    amberWeight: 0,
    dangerSign: true,
  },
];

const SETS: Record<TriageRole, Question[]> = {
  child: CHILD,
  adult: ADULT,
  pregnant: PREGNANT,
};

/**
 * What the family is told when no urgent sign is found: what to do at home,
 * and the signs that mean they should call again. Shown by the ASHA app on a
 * home-care result, saved with the concern, and spoken by the voice line, so
 * everyone gives the same advice. `spoken` is the same advice as a person
 * would say it on the phone, not a list read aloud.
 */
export const HOME_CARE: Record<TriageRole, HomeCare & { spoken: [string, string] }> = {
  child: {
    tell: ["Give small sips of fluid often", "Keep the child cool and lightly dressed", "Keep feeding as usual"],
    callIf: ["Breathing becomes fast or difficult", "The child stops drinking or feeding", "The fever lasts 2 more days"],
    spoken: [
      "At home, give small sips of fluid often, keep the child cool and lightly dressed, and keep feeding as usual.",
      "Call us again if the breathing becomes fast or difficult, if the child stops drinking or feeding, or if the fever lasts two more days.",
    ],
  },
  adult: {
    tell: ["Rest", "Drink plenty of water", "Take paracetamol if the fever is high"],
    callIf: ["Chest pain, or breathless while resting", "Too weak to do daily work", "The fever lasts 2 more days"],
    spoken: [
      "At home, rest, drink plenty of water, and take paracetamol if the fever is high.",
      "Call us again if there is chest pain or breathlessness while resting, if you become too weak for daily work, or if the fever lasts two more days.",
    ],
  },
  pregnant: {
    tell: ["Rest lying on the left side", "Drink plenty of water", "Keep taking the iron tablets"],
    callIf: ["Any bleeding, or the waters break", "Severe headache or blurred vision", "The baby moves less than usual"],
    spoken: [
      "At home, rest lying on your left side, drink plenty of water, and keep taking your iron tablets.",
      "Call us again at once if there is any bleeding or the waters break, if you have a severe headache or blurred vision, or if the baby moves less than usual.",
    ],
  },
};

/** The advice to save with a concern: the lists only, not the spoken form. */
export function homeCareFor(role: TriageRole): HomeCare {
  const { tell, callIf } = HOME_CARE[role];
  return { tell, callIf };
}

/** Map a family member's role onto a question set. Mothers use the adult set. */
export function toTriageRole(role: Member["role"]): TriageRole {
  return role === "mother" ? "adult" : role;
}

export function getQuestions(role: TriageRole): Question[] {
  return SETS[role];
}

function answerFor(answers: TriageAnswer[], questionId: string): TriageAnswer["answer"] | undefined {
  return answers.find((a) => a.questionId === questionId)?.answer;
}

/**
 * Evaluate answers against the role's question set.
 * - Any danger sign answered "yes" stops immediately: red.
 * - Otherwise ≥ AMBER_THRESHOLD amber "yes" answers: amber, else green.
 * Reasons: labels of "yes" answers, plus one "not found" line for each
 * danger sign that was answered "no".
 */
export function evaluate(role: TriageRole, answers: TriageAnswer[]): TriageResult {
  const reasons: string[] = [];
  const notFound: string[] = [];
  let amber = 0;

  for (const q of getQuestions(role)) {
    const a = answerFor(answers, q.id);
    if (a === "yes") {
      reasons.push(q.label);
      if (q.dangerSign) return { urgency: "red", reasons };
      amber += q.amberWeight;
    } else if (a === "no" && q.dangerSign && q.notFound) {
      notFound.push(q.notFound);
    }
  }

  return {
    urgency: amber >= AMBER_THRESHOLD ? "amber" : "green",
    reasons: [...reasons, ...notFound],
  };
}

/**
 * The next unanswered question in fixed order, or null when every question
 * is answered or a danger sign has already been answered "yes".
 */
export function nextQuestion(role: TriageRole, answers: TriageAnswer[]): Question | null {
  const questions = getQuestions(role);
  const dangerHit = questions.some((q) => q.dangerSign && answerFor(answers, q.id) === "yes");
  if (dangerHit) return null;
  return questions.find((q) => answerFor(answers, q.id) === undefined) ?? null;
}

/** Serialise answers for a URL query value, e.g. "child_fever:yes,child_vomiting:no". */
export function encodeAnswers(answers: TriageAnswer[]): string {
  return answers.map((a) => `${a.questionId}:${a.answer}`).join(",");
}

/** Inverse of encodeAnswers. Ignores malformed entries. */
export function decodeAnswers(value: string | null): TriageAnswer[] {
  if (!value) return [];
  const out: TriageAnswer[] = [];
  for (const part of value.split(",")) {
    const [questionId, answer] = part.split(":");
    if (questionId && (answer === "yes" || answer === "no")) out.push({ questionId, answer });
  }
  return out;
}
