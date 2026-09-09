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
      <section className="screen">
        <p className="screen__empty">Member not found.</p>
        <Link className="screen__back" to="/asha">
          Back to today
        </Link>
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
    <section className="screen">
      <Link
        className="screen__back"
        to={`/asha/family/${familyId}/check/${memberId}/result?a=${params.get("a") ?? ""}`}
      >
        Back to result
      </Link>
      <h1 className="screen__title">Book PHC visit</h1>
      <p className="screen__sub">
        {member.name}, {member.age} · {PHC.facility}, {PHC.doctor}
      </p>

      <fieldset className="choices">
        <legend className="choices__legend">Day</legend>
        <span className="choices__set choices__set--stack">
          {DAYS.map((d) => (
            <label key={d.date} className="choice">
              <input
                className="choice__input"
                type="radio"
                name="day"
                value={d.date}
                checked={date === d.date}
                onChange={() => {
                  setDate(d.date);
                  setSlot(null);
                }}
              />
              <span>
                {d.label} ({d.date})
              </span>
            </label>
          ))}
        </span>
      </fieldset>

      <fieldset className="choices">
        <legend className="choices__legend">Slot</legend>
        <span className="choices__set">
          {SLOTS.map((s) => {
            const taken = takenSlots.has(s);
            return (
              <label key={s} className="choice">
                <input
                  className="choice__input"
                  type="radio"
                  name="slot"
                  value={s}
                  disabled={taken}
                  checked={slot === s}
                  onChange={() => setSlot(s)}
                />
                <span>
                  {s}
                  {taken && " (taken)"}
                </span>
              </label>
            );
          })}
        </span>
      </fieldset>

      <p className="screen__action">
        <button type="button" className="btn btn--primary btn--block btn--tall" onClick={confirm} disabled={!slot}>
          Confirm booking
        </button>
      </p>
    </section>
  );
}
