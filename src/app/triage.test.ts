import { describe, expect, it } from "vitest";
import { evaluate, getQuestions, nextQuestion } from "./triage";
import type { TriageAnswer } from "./types";

const yes = (questionId: string): TriageAnswer => ({ questionId, answer: "yes" });
const no = (questionId: string): TriageAnswer => ({ questionId, answer: "no" });

describe("question sets", () => {
  it.each(["child", "adult", "pregnant"] as const)("%s set has ≤ 4 questions and one danger sign", (role) => {
    const qs = getQuestions(role);
    expect(qs.length).toBeLessThanOrEqual(4);
    expect(qs.filter((q) => q.dangerSign)).toHaveLength(1);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
});

describe("evaluate", () => {
  it("danger sign answered yes stops early and returns red", () => {
    // Only the danger question answered; earlier amber questions untouched.
    const r = evaluate("child", [yes("child_breathing")]);
    expect(r.urgency).toBe("red");
    expect(r.reasons).toEqual(["Breathing fast or difficulty breathing"]);
  });

  it("red even when amber answers are also yes; includes their labels", () => {
    const r = evaluate("child", [yes("child_fever"), no("child_vomiting"), no("child_feeding"), yes("child_breathing")]);
    expect(r.urgency).toBe("red");
    expect(r.reasons).toEqual(["Fever more than 2 days", "Breathing fast or difficulty breathing"]);
  });

  it("two amber yes answers return amber with a not-found line", () => {
    const r = evaluate("child", [yes("child_fever"), no("child_vomiting"), yes("child_feeding"), no("child_breathing")]);
    expect(r.urgency).toBe("amber");
    expect(r.reasons).toEqual(["Fever more than 2 days", "Drinking or feeding less than usual", "No fast breathing"]);
  });

  it("one amber yes answer returns green", () => {
    const r = evaluate("adult", [yes("adult_fever"), no("adult_pain"), no("adult_weakness"), no("adult_chest")]);
    expect(r.urgency).toBe("green");
    expect(r.reasons).toEqual(["Fever more than 2 days", "No chest pain or breathlessness"]);
  });

  it("no yes answers return green with only the not-found line", () => {
    const r = evaluate("pregnant", [
      no("pregnant_headache"),
      no("pregnant_swelling"),
      no("pregnant_movement"),
      no("pregnant_bleeding"),
    ]);
    expect(r.urgency).toBe("green");
    expect(r.reasons).toEqual(["No bleeding"]);
  });
});

describe("nextQuestion", () => {
  it("walks the set in fixed order", () => {
    expect(nextQuestion("child", [])?.id).toBe("child_fever");
    expect(nextQuestion("child", [no("child_fever")])?.id).toBe("child_vomiting");
    expect(nextQuestion("child", [no("child_fever"), yes("child_vomiting"), no("child_feeding")])?.id).toBe(
      "child_breathing",
    );
  });

  it("returns null when all questions are answered", () => {
    const all = getQuestions("adult").map((q) => no(q.id));
    expect(nextQuestion("adult", all)).toBeNull();
  });

  it("returns null after a danger sign, even if other questions are unanswered", () => {
    expect(nextQuestion("pregnant", [yes("pregnant_bleeding")])).toBeNull();
  });
});
