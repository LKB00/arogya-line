// One question per screen, driven by triage.nextQuestion (SPEC 6.1 SymptomCheck).
// Answers live in the URL (?a=...) so browser back steps one question back.

import { useEffect, type CSSProperties } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { decodeAnswers, encodeAnswers, getQuestions, nextQuestion, toTriageRole } from "../../app/triage";
import type { TriageAnswer } from "../../app/types";
import { memberLine } from "../../app/format";

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
      <section className="screen">
        <p className="screen__empty">Member not found.</p>
        <Link className="screen__back" to="/asha">
          Back to today
        </Link>
      </section>
    );
  }
  if (!question) return null;

  const answer = (value: TriageAnswer["answer"]) => {
    const next = [...answers, { questionId: question.id, answer: value }];
    navigate(`${base}?a=${encodeAnswers(next)}`);
  };

  return (
    <section className="screen">
      <Link className="screen__back" to={`/asha/family/${familyId}`}>
        Back to {family.head}
      </Link>
      <h1 className="screen__title">{member.name}</h1>
      <p className="screen__sub">{memberLine(member)}</p>
      <div className="progress">
        <p className="progress__label">
          Question {answers.length + 1} of {total}
        </p>
        {/* The bar carries no new information, so it stays out of the reading order. */}
        <div className="progress__track" aria-hidden="true">
          <div
            className="progress__fill"
            style={{ "--step": answers.length + 1, "--steps": total } as CSSProperties}
          />
        </div>
      </div>
      <p className="question">{question.text}</p>
      <p>
        <button type="button" className="btn btn--quiet read-aloud" aria-label="Read aloud">
          Read aloud
        </button>
      </p>
      <p className="screen__action answers">
        <button type="button" className="btn btn--answer btn--tall" onClick={() => answer("yes")}>
          Yes
        </button>
        <button type="button" className="btn btn--answer btn--tall" onClick={() => answer("no")}>
          No
        </button>
      </p>
    </section>
  );
}
