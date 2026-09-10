// Family members, with the open concern marked (SPEC 6.1 FamilyDetail).

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { latestAdviceFor, useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { URGENCY_LABEL, dayLabel, memberAge } from "../../app/format";

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
  const adviceFor = latestAdvice
    ? family.members.find((m) => m.id === concerns.find((c) => c.id === latestAdvice.concernId)?.memberId)
    : undefined;

  // The person with something open is why she is here: they come first.
  const members = [...family.members].sort(
    (a, b) => Number(Boolean(openConcernFor(b.id))) - Number(Boolean(openConcernFor(a.id))),
  );

  return (
    <section className="screen">
      <header className="screen__header">
        <p className="screen__eyebrow">
          Family {family.id} · {family.village}
        </p>
        <h1 className="screen__title">{family.head}</h1>
      </header>

      <ul className="members">
        {members.map((m) => {
          const open = openConcernFor(m.id);
          return (
            <li key={m.id}>
              <Link
                className={open ? `member member--open urgency--${open.urgency}` : "member"}
                to={`/asha/family/${family.id}/check/${m.id}`}
                aria-label={`Check symptoms of ${m.name}`}
              >
                <span className="member__main">
                  <span className="member__head">
                    <span className="member__name">{m.name}</span>
                    <span className="member__age">{memberAge(m)}</span>
                  </span>
                  {open ? (
                    <span className="member__why">
                      <span className="urgency urgency--inline">{URGENCY_LABEL[open.urgency]}</span>
                      {m.note && <span className="member__note">{m.note}</span>}
                    </span>
                  ) : (
                    m.note && <span className="member__note">{m.note}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Only when a doctor has actually left a note. v1 has no audio: opening
          it shows the words. */}
      {latestAdvice && (
        <div className={showNote ? "advice advice--open" : "advice"}>
          <button type="button" className="advice__toggle" aria-expanded={showNote} onClick={() => setShowNote((v) => !v)}>
            <span className="advice__icon" aria-hidden="true" />
            <span className="advice__main">
              <span className="advice__label">Hear last doctor note</span>
              <span className="advice__meta">
                {latestAdvice.doctor} · {dayLabel(latestAdvice.date)}
                {adviceFor && ` · for ${adviceFor.name}`}
              </span>
            </span>
          </button>
          {showNote && <blockquote className="note">{latestAdvice.advice}</blockquote>}
        </div>
      )}
    </section>
  );
}
