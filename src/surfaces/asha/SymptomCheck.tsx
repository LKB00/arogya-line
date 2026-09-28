// One question per screen, driven by triage.nextQuestion (SPEC 6.1 SymptomCheck).
// Answers live in the URL (?a=...) so browser back steps one question back.
//
// The question is the screen: a large picture of the thing asked about, then
// the words. The answers given so far stay visible as chips, so she can see
// the path the check has taken. Yes and No share size, colour and weight: the
// design never nudges a clinical answer.

import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { decodeAnswers, encodeAnswers, getQuestions, nextQuestion, toTriageRole } from "../../app/triage";
import type { TriageAnswer } from "../../app/types";
import Icon from "../../shell/Icon";
import { iconFor, shortName } from "./pictograms";

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
      </section>
    );
  }
  if (!question) return null;

  const answer = (value: TriageAnswer["answer"]) => {
    const next = [...answers, { questionId: question.id, answer: value }];
    navigate(`${base}?a=${encodeAnswers(next)}`);
  };

  const step = answers.length + 1;

  return (
    <>
      <header className="appbar">
        <Link className="iconbtn" to={`/asha/family/${familyId}`} aria-label="Stop the check" title="Stop the check">
          <Icon icon={IconX} size={24} />
        </Link>
        <p className="appbar__title">
          Checking {member.name}, {member.age}
        </p>
        <p className="appbar__aside">
          {step} of {total}
        </p>
      </header>
      <section className="screen screen--check">
        {/* One segment per question: done, the current one, still to come. */}
        <span className="steps" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < step - 1 ? "steps__seg is-done" : i === step - 1 ? "steps__seg is-now" : "steps__seg"} />
          ))}
        </span>

        {answers.length > 0 && (
          <ul className="answered" aria-label="Answered so far">
            {answers.map((a) => (
              <li key={a.questionId} className="answered__chip">
                <Icon icon={iconFor(a.questionId)} size={16} />
                {shortName(a.questionId)} · {a.answer === "yes" ? "Yes" : "No"}
              </li>
            ))}
          </ul>
        )}

        <div className="ask" key={question.id}>
          <span className="ask__picture">
            <Icon icon={iconFor(question.id)} size={40} />
          </span>
          <h1 className="ask__question">{question.text}</h1>
        </div>
      </section>
      <div className="answers">
        <button type="button" className="answer" onClick={() => answer("yes")}>
          <Icon icon={IconCheck} size={24} />
          Yes
        </button>
        <button type="button" className="answer" onClick={() => answer("no")}>
          <Icon icon={IconX} size={24} />
          No
        </button>
      </div>
    </>
  );
}
