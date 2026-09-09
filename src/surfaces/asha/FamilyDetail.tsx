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
      <section>
        <p>Family {familyId} not found.</p>
        <Link to="/asha">Back to today</Link>
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
    <section>
      <p>
        <Link to="/asha">Back to today</Link>
      </p>
      <h1>
        {family.head} · {family.id}
      </h1>
      <p>
        {family.village} · {family.phone}
      </p>
      <ul>
        {family.members.map((m) => {
          const open = openConcernFor(m.id);
          return (
            <li key={m.id}>
              {m.name}, {m.age}, {m.role}
              {m.note && <> · {m.note}</>}
              {open && <strong> · open concern ({open.urgency})</strong>}{" "}
              <Link to={`/asha/family/${family.id}/check/${m.id}`}>Check symptoms</Link>
            </li>
          );
        })}
      </ul>
      <p>
        <button type="button" onClick={() => setShowNote((v) => !v)}>
          Hear last doctor note
        </button>
      </p>
      {showNote && (
        <blockquote>
          {latestAdvice ? `${latestAdvice.doctor}, ${latestAdvice.date}: ${latestAdvice.advice}` : "No advice yet."}
        </blockquote>
      )}
    </section>
  );
}
