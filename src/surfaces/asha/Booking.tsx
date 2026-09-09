// Pick a day and slot, then create Concern + Booking (SPEC 6.1 Booking).

import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { PHC, SLOTS, isoDate } from "../../app/seed";
import { decodeAnswers, evaluate, toTriageRole } from "../../app/triage";

const DAYS = [0, 1, 2].map((offset) => ({
  date: isoDate(offset),
  label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "Day after",
}));

export default function Booking() {
  const { familyId = "", memberId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const member = family?.members.find((m) => m.id === memberId);
  const bookings = useStore((s) => s.bookings);
  const createConcern = useStore((s) => s.createConcern);
  const createBooking = useStore((s) => s.createBooking);

  const [date, setDate] = useState(DAYS[1].date);
  const [slot, setSlot] = useState<string | null>(null);

  if (!family || !member) {
    return (
      <section>
        <p>Member not found.</p>
        <Link to="/asha">Back to today</Link>
      </section>
    );
  }

  const takenSlots = new Set(bookings.filter((b) => b.date === date).map((b) => b.slot));
  const answers = decodeAnswers(params.get("a"));
  const { urgency, reasons } = evaluate(toTriageRole(member.role), answers);

  const confirm = () => {
    if (!slot) return;
    const concern = createConcern({ familyId: family.id, memberId: member.id, source: "asha", answers, urgency, reasons });
    const booking = createBooking({ concernId: concern.id, date, slot, facility: PHC.facility, doctor: PHC.doctor });
    navigate(`/asha/booked/${booking.id}`, { replace: true });
  };

  return (
    <section>
      <p>
        <Link to={`/asha/family/${familyId}/check/${memberId}/result?a=${params.get("a") ?? ""}`}>Back to result</Link>
      </p>
      <h1>Book PHC visit</h1>
      <p>
        {member.name}, {member.age} · {PHC.facility}, {PHC.doctor}
      </p>

      <fieldset>
        <legend>Day</legend>
        {DAYS.map((d) => (
          <label key={d.date}>
            <input
              type="radio"
              name="day"
              value={d.date}
              checked={date === d.date}
              onChange={() => {
                setDate(d.date);
                setSlot(null);
              }}
            />{" "}
            {d.label} ({d.date}){" "}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Slot</legend>
        {SLOTS.map((s) => {
          const taken = takenSlots.has(s);
          return (
            <label key={s}>
              <input type="radio" name="slot" value={s} disabled={taken} checked={slot === s} onChange={() => setSlot(s)} />{" "}
              {s}
              {taken && " (taken)"}{" "}
            </label>
          );
        })}
      </fieldset>

      <p>
        <button type="button" onClick={confirm} disabled={!slot}>
          Confirm booking
        </button>
      </p>
    </section>
  );
}
