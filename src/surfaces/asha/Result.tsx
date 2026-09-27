// Triage outcome and next step (SPEC 6.1 Result).
//
// A shared decision: the verdict fills the top in the IMNCI chart's colour,
// with an icon and the word, and names the person and the action in plain
// words. Below it, what she found, each answer with its picture, and any
// danger sign ruled out, so the call is hers and the PHC's together. The next
// step is the one primary button, at the thumb.

import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarEvent,
  IconInfoCircle,
  IconHomeHeart,
  IconPhone,
  IconPhoneCall,
  IconStethoscope,
} from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { shortDate, slotLabel } from "../../app/format";
import { decodeAnswers, evaluate, getQuestions, nextQuestion, toTriageRole } from "../../app/triage";
import type { Urgency } from "../../app/types";
import Icon from "../../shell/Icon";
import UrgencyChip from "./UrgencyChip";
import { iconForReason } from "./pictograms";

const VERDICT_ICON = { red: IconAlertTriangle, amber: IconStethoscope, green: IconHomeHeart } as const;

const HEADLINE: Record<Urgency, (name: string) => string> = {
  green: (n) => `${n} can be cared for at home`,
  amber: (n) => `${n} should see the doctor`,
  red: (n) => `${n} needs the PHC now`,
};

/** One line under the headline: what happens next, in her words. */
const NEXT: Record<Urgency, string> = {
  green: "Give the family home-care advice. No visit is needed now.",
  amber: "Book a PHC visit in the next few days.",
  red: "This is a danger sign. Call the PHC before you do anything else.",
};

export default function Result() {
  const { familyId = "", memberId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const member = family?.members.find((m) => m.id === memberId);
  const createConcern = useStore((s) => s.createConcern);
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);

  if (!family || !member) {
    return (
      <section className="screen">
        <p className="screen__empty">Member not found.</p>
      </section>
    );
  }

  const answers = decodeAnswers(params.get("a"));
  const role = toTriageRole(member.role);

  // A verdict is only shown for a finished check. Reached any other way (a
  // bookmark, a shared link, back from booking with the answers lost) it
  // would read "can be cared for at home" from no answers at all: false
  // reassurance about a sick person. Send her to the next question instead.
  if (nextQuestion(role, answers)) {
    return <Navigate to={`/asha/family/${familyId}/check/${memberId}?a=${params.get("a") ?? ""}`} replace />;
  }

  const { urgency, reasons } = evaluate(role, answers);
  const query = `a=${params.get("a") ?? ""}`;
  const questions = getQuestions(role);

  // evaluate() lists what was found first, then the danger signs ruled out.
  const found = reasons.slice(0, answers.filter((a) => a.answer === "yes").length);
  const clear = reasons.slice(found.length);
  const isDanger = (r: string) => questions.some((q) => q.label === r && q.dangerSign);

  // Checked again while a visit is already booked: say so, so a second
  // visit is a choice she makes, not an accident.
  const upcoming = bookings.find(
    (b) => b.date >= isoDate(0) && concerns.some((c) => c.id === b.concernId && c.memberId === member.id),
  );

  const saveHomeCare = () => {
    createConcern({ familyId: family.id, memberId: member.id, source: "asha", answers, urgency, reasons });
    navigate("/asha");
  };

  return (
    <>
      <section className="screen screen--result">
        <header className={`verdict tri--${urgency}`}>
          <Link className="iconbtn verdict__back" to={`/asha/family/${familyId}`} aria-label={`Back to ${family.head}'s family`}>
            <Icon icon={IconArrowLeft} size={24} />
          </Link>
          <span className="verdict__mark">
            <Icon icon={VERDICT_ICON[urgency]} size={24} />
          </span>
          <UrgencyChip urgency={urgency} />
          <h1 className="verdict__headline">{HEADLINE[urgency](member.name)}</h1>
          <p className="verdict__next">{NEXT[urgency]}</p>
        </header>

        {reasons.length > 0 && (
          <section className="block">
            <div className="block__head">
              <h2 className="block__title">What you found</h2>
              <p className="block__sub">
                {answers.length} {answers.length === 1 ? "question" : "questions"} · {found.length} found
                {clear.length > 0 && ", danger sign ruled out"}
              </p>
            </div>
            <ul className="listcard">
              {found.map((r) => (
                <li key={r} className="finding">
                  <span className="finding__disc">
                    <Icon icon={iconForReason(member.role, r)} />
                  </span>
                  <span className="finding__text">{r}</span>
                  <span className={isDanger(r) ? `tag tag--danger` : `tag tri--${urgency}`}>{isDanger(r) ? "Danger sign" : "Found"}</span>
                </li>
              ))}
              {clear.map((r) => (
                <li key={r} className="finding finding--clear">
                  <span className="finding__disc">
                    <Icon icon={iconForReason(member.role, r)} />
                  </span>
                  <span className="finding__text">{r}</span>
                  <span className="tag tri--green">Ruled out</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <div className="footbar footbar--plain">
        {upcoming && urgency !== "red" && (
          <p className="notice">
            <Icon icon={IconInfoCircle} />
            <span>
              {member.name} already has a PHC visit on {shortDate(upcoming.date)}, {slotLabel(upcoming.slot)}.
              {urgency === "amber" && " Booking again adds a second visit."}
            </span>
          </p>
        )}
        {urgency === "green" && (
          <button type="button" className="btn btn--primary btn--block btn--tall" onClick={saveHomeCare}>
            <Icon icon={IconHomeHeart} />
            Save home-care advice
          </button>
        )}
        {urgency === "amber" && (
          <>
            <button
              type="button"
              className="btn btn--primary btn--block btn--tall"
              onClick={() => navigate(`/asha/family/${familyId}/check/${memberId}/booking?${query}`)}
            >
              <Icon icon={IconCalendarEvent} />
              Book PHC visit
            </button>
            <button type="button" className="btn btn--secondary btn--block btn--tall" onClick={() => navigate(`/voice?family=${familyId}`)}>
              <Icon icon={IconPhone} />
              Call the doctor line
            </button>
          </>
        )}
        {urgency === "red" && (
          <button
            type="button"
            className="btn btn--danger btn--block btn--tall"
            onClick={() => navigate(`/voice?mode=emergency&family=${familyId}&member=${memberId}&${query}`)}
          >
            <Icon icon={IconPhoneCall} />
            Call PHC now
          </button>
        )}
      </div>
    </>
  );
}
