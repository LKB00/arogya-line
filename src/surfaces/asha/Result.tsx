// Triage outcome and next step (SPEC 6.1 Result).

import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { decodeAnswers, evaluate, toTriageRole } from "../../app/triage";
import type { Urgency } from "../../app/types";

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
      <section>
        <p>Member not found.</p>
        <Link to="/asha">Back to today</Link>
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
    <section>
      <p>
        <Link to={`/asha/family/${familyId}`}>Back to {family.head}</Link>
      </p>
      <h1>
        {urgency.toUpperCase()}: {HEADLINE[urgency]}
      </h1>
      <p>
        {member.name}, {member.age}
      </p>
      <ul>
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      {urgency === "green" && (
        <p>
          <button type="button" onClick={saveHomeCare}>
            Save home-care advice
          </button>
        </p>
      )}

      {urgency === "amber" && (
        <p>
          <button type="button" onClick={() => navigate(`/asha/family/${familyId}/check/${memberId}/booking?${query}`)}>
            Book PHC visit
          </button>{" "}
          <button type="button" onClick={() => navigate(`/voice?family=${familyId}`)}>
            Call the doctor line
          </button>
        </p>
      )}

      {urgency === "red" && (
        <p>
          <button
            type="button"
            onClick={() => navigate(`/voice?mode=emergency&family=${familyId}&member=${memberId}&${query}`)}
          >
            Call PHC now
          </button>
        </p>
      )}
    </section>
  );
}
