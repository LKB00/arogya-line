// Triage outcome and next step (SPEC 6.1 Result).
//
// A screening result, not a diagnosis: the verdict fills the top in the IMNCI
// chart's colour, with an icon and the word, and says what was (or was not)
// found and the action in plain words. A home-care result carries the advice
// itself, so "save" saves something she has given. Below it, what she found, each answer with its picture, and any
// danger sign ruled out, so the call is hers and the PHC's together. The next
// step is the one primary button, at the thumb.

import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarEvent,
  IconCheck,
  IconInfoCircle,
  IconHomeHeart,
  IconPhone,
  IconPhoneCall,
  IconStethoscope,
} from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { shortDate, slotLabel } from "../../app/format";
import { HOME_CARE, decodeAnswers, evaluate, getQuestions, homeCareFor, nextQuestion, toTriageRole } from "../../app/triage";
import type { Urgency } from "../../app/types";
import Icon from "../../shell/Icon";
import UrgencyChip from "./UrgencyChip";
import { iconForReason } from "./pictograms";

const VERDICT_ICON = { red: IconAlertTriangle, amber: IconStethoscope, green: IconHomeHeart } as const;

const HEADLINE: Record<Urgency, (name: string) => string> = {
  green: (n) => `No urgent signs found for ${n}`,
  amber: (n) => `${n} should see the doctor`,
  red: (n) => `${n} needs the PHC now`,
};

/** One line under the headline: what happens next, in her words. */
const NEXT: Record<Urgency, string> = {
  green: "Home care can be given. Tell the family what to do, and when to call again.",
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

  const homeCare = HOME_CARE[role];

  const saveHomeCare = () => {
    // The advice on screen is saved with the concern, so the family can hear
    // it again on the voice line and the family screen shows what was given.
    createConcern({ familyId: family.id, memberId: member.id, source: "asha", answers, urgency, reasons, homeCare: homeCareFor(role) });
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
          {/* What the answers suggest, by an illustrative protocol: a screening, never a diagnosis. */}
          <p className="verdict__kind">Screening result</p>
          <h1 className="verdict__headline">{HEADLINE[urgency](member.name)}</h1>
          <p className="verdict__next">
            {urgency === "amber" && upcoming
              ? `A PHC visit is already booked: ${shortDate(upcoming.date)}, ${slotLabel(upcoming.slot)}.`
              : NEXT[urgency]}
          </p>
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

        {/* Plain lines, no icon each: the heading already says what they are. */}
        {urgency === "green" && (
          <>
            <section className="block">
              <h2 className="block__title">Tell the family</h2>
              <ul className="listcard">
                {homeCare.tell.map((t) => (
                  <li key={t} className="finding">
                    <span className="finding__text">{t}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="block">
              <h2 className="block__title">Call again if</h2>
              <ul className="listcard">
                {homeCare.callIf.map((t) => (
                  <li key={t} className="finding">
                    <span className="finding__text">{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </section>

      <div className="footbar footbar--plain">
        {/* Already booked and checked again: the likely intention is the visit
            she has, so it leads; a second visit is the deliberate choice. */}
        {upcoming && urgency === "green" && (
          <p className="notice">
            <Icon icon={IconInfoCircle} />
            <span>
              {member.name} already has a PHC visit on {shortDate(upcoming.date)}, {slotLabel(upcoming.slot)}.
            </span>
          </p>
        )}
        {urgency === "green" && (
          <button type="button" className="btn btn--primary btn--block btn--tall" onClick={saveHomeCare}>
            <Icon icon={IconCheck} />
            Save this advice
          </button>
        )}
        {urgency === "amber" && upcoming && (
          <>
            <button type="button" className="btn btn--primary btn--block btn--tall" onClick={() => navigate(`/asha/booked/${upcoming.id}`)}>
              <Icon icon={IconCalendarEvent} />
              View existing visit
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block btn--tall"
              onClick={() => navigate(`/asha/family/${familyId}/check/${memberId}/booking?${query}`)}
            >
              Book another visit
            </button>
          </>
        )}
        {urgency === "amber" && !upcoming && (
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
