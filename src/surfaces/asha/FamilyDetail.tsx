// Family members, with the open concern marked (SPEC 6.1 FamilyDetail).

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { latestAdviceFor, useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { URGENCY_LABEL, dayLabel, memberLine } from "../../app/format";

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
      <header className="screen__header">
        <p className="screen__eyebrow">Family {family.id}</p>
        <h1 className="screen__title">{family.head}</h1>
        <p className="screen__sub">
          {family.village} · {family.phone}
        </p>
      </header>
      <h2>Family members</h2>
      <ul className="members">
        {family.members.map((m) => {
          const open = openConcernFor(m.id);
          return (
            <li key={m.id} className={open ? "member member--flagged" : "member"}>
              <span className="member__name">{m.name}</span>
              <span className="member__meta">
                {memberLine(m)}
                {m.note && <span className="member__note">{m.note}</span>}
              </span>
              {open && <span className={`urgency urgency--${open.urgency}`}>{URGENCY_LABEL[open.urgency]}</span>}
              <Link className="btn btn--secondary btn--compact" to={`/asha/family/${family.id}/check/${m.id}`}>
                Check
                <span className="visually-hidden"> symptoms of {m.name}</span>
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
          {latestAdvice ? (
            <>
              <span className="note__who">
                {latestAdvice.doctor} · {dayLabel(latestAdvice.date)}
              </span>
              {latestAdvice.advice}
            </>
          ) : (
            "No advice yet."
          )}
        </blockquote>
      )}
    </section>
  );
}
