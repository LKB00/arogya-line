// Family members, with the open concern marked (SPEC 6.1 FamilyDetail).

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { latestAdviceFor, useStore } from "../../app/store";
import { isoDate } from "../../app/seed";

export default function FamilyDetail() {
  const { familyId = "" } = useParams();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const [showNote, setShowNote] = useState(false);

  if (!family) {
    return (
      <section className="screen">
        <p className="screen__empty">Family {familyId} not found.</p>
        <Link className="screen__back" to="/asha">
          Back to today
        </Link>
      </section>
    );
  }

  // A concern is "open" while it has no booking, or its booking is still to come.
  const today = isoDate(0);
  const openConcernFor = (memberId: string) =>
    concerns.find((c) => {
      if (c.familyId !== family.id || c.memberId !== memberId) return false;
      const booking = bookings.find((b) => b.concernId === c.id);
      return !booking || booking.date >= today;
    });

  const latestAdvice = latestAdviceFor({ concerns, bookings }, family.id);

  return (
    <section className="screen">
      <Link className="screen__back" to="/asha">
        Back to today
      </Link>
      <h1 className="screen__title">
        {family.head} · {family.id}
      </h1>
      <p className="family__meta">
        {family.village} · {family.phone}
      </p>
      <ul className="members">
        {family.members.map((m) => {
          const open = openConcernFor(m.id);
          return (
            <li key={m.id} className={open ? "member member--flagged" : "member"}>
              <span className="member__name">
                {m.name}, {m.age}, {m.role}
              </span>
              {m.note && <span className="member__meta">{m.note}</span>}
              {open && (
                <span className={`urgency urgency--${open.urgency}`}>
                  <span className="member__flag">open concern ({open.urgency})</span>
                </span>
              )}
              <Link className="btn btn--secondary" to={`/asha/family/${family.id}/check/${m.id}`}>
                Check symptoms
              </Link>
            </li>
          );
        })}
      </ul>
      <p>
        <button type="button" className="btn btn--quiet read-aloud" onClick={() => setShowNote((v) => !v)}>
          Hear last doctor note
        </button>
      </p>
      {showNote && (
        <blockquote className="note">
          {latestAdvice ? `${latestAdvice.doctor}, ${latestAdvice.date}: ${latestAdvice.advice}` : "No advice yet."}
        </blockquote>
      )}
    </section>
  );
}
