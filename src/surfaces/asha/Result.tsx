// Triage outcome and next step (SPEC 6.1 Result).

import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { decodeAnswers, evaluate, toTriageRole } from "../../app/triage";
import type { Urgency } from "../../app/types";
import { URGENCY_LABEL, memberAge } from "../../app/format";

const HEADLINE: Record<Urgency, string> = {
  green: "Care at home",
  amber: "Should see the doctor",
  red: "Needs the PHC now",
};

export default function Result() {
  const { familyId = "", memberId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const member = family?.members.find((m) => m.id === memberId);
  const createConcern = useStore((s) => s.createConcern);

  if (!family || !member) {
    return (
      <section className="screen">
        <p className="screen__empty">Member not found.</p>
      </section>
    );
  }

  const answers = decodeAnswers(params.get("a"));
  const role = toTriageRole(member.role);
  const { urgency, reasons } = evaluate(role, answers);
  const query = `a=${params.get("a") ?? ""}`;

  const saveHomeCare = () => {
    createConcern({ familyId: family.id, memberId: member.id, source: "asha", answers, urgency, reasons });
    navigate("/asha");
  };

  return (
    <section className="screen">
      <div className={`result__banner urgency--${urgency}`}>
        <p className="result__label">{URGENCY_LABEL[urgency]}</p>
        <h1 className="result__headline">{HEADLINE[urgency]}</h1>
        <p className="result__who">
          {member.name} · {memberAge(member)}
        </p>
      </div>
      <ul className="reasons">
        {reasons.map((r) => (
          <li key={r} className="reasons__item">
            {r}
          </li>
        ))}
      </ul>

      {urgency === "green" && (
        <p className="screen__action">
          <button type="button" className="btn btn--primary btn--block btn--tall" onClick={saveHomeCare}>
            Save home-care advice
          </button>
        </p>
      )}

      {urgency === "amber" && (
        <p className="screen__action">
          <button
            type="button"
            className="btn btn--primary btn--block btn--tall"
            onClick={() => navigate(`/asha/family/${familyId}/check/${memberId}/booking?${query}`)}
          >
            Book PHC visit
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => navigate(`/voice?family=${familyId}`)}
          >
            Call the doctor line
          </button>
        </p>
      )}

      {urgency === "red" && (
        <p className="screen__action">
          <button
            type="button"
            className="btn btn--primary btn--block btn--tall"
            onClick={() => navigate(`/voice?mode=emergency&family=${familyId}&member=${memberId}&${query}`)}
          >
            Call PHC now
          </button>
        </p>
      )}
    </section>
  );
}
