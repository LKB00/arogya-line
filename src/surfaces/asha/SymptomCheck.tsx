// One question per screen, driven by triage.nextQuestion (SPEC 6.1 SymptomCheck).
// Answers live in the URL (?a=...) so browser back steps one question back.

import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { decodeAnswers, encodeAnswers, getQuestions, nextQuestion, toTriageRole } from "../../app/triage";
import type { TriageAnswer } from "../../app/types";

export default function SymptomCheck() {
  const { familyId = "", memberId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const member = family?.members.find((m) => m.id === memberId);

  const answers = decodeAnswers(params.get("a"));
  const role = member ? toTriageRole(member.role) : null;
  const question = role ? nextQuestion(role, answers) : null;
  const total = role ? getQuestions(role).length : 0;
  const base = `/asha/family/${familyId}/check/${memberId}`;

  // Done (all answered or danger sign hit): hand over to Result.
  useEffect(() => {
    if (role && !question) {
      navigate(`${base}/result?a=${encodeAnswers(answers)}`, { replace: true });
    }
  });

  if (!family || !member || !role) {
    return (
      <section>
        <p>Member not found.</p>
        <Link to="/asha">Back to today</Link>
      </section>
    );
  }
  if (!question) return null;

  const answer = (value: TriageAnswer["answer"]) => {
    const next = [...answers, { questionId: question.id, answer: value }];
    navigate(`${base}?a=${encodeAnswers(next)}`);
  };

  return (
    <section>
      <p>
        <Link to={`/asha/family/${familyId}`}>Back to {family.head}</Link>
      </p>
      <h1>
        {member.name}, {member.age}
      </h1>
      <p>
        Question {answers.length + 1} of {total}
      </p>
      <p>{question.text}</p>
      <p>
        <button type="button" aria-label="Read aloud">
          Read aloud
        </button>
      </p>
      <p>
        <button type="button" onClick={() => answer("yes")}>
          Yes
        </button>{" "}
        <button type="button" onClick={() => answer("no")}>
          No
        </button>
      </p>
    </section>
  );
}
