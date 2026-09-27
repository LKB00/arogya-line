// Pick a day and slot, then create Concern + Booking (SPEC 6.1 Booking).
//
// Choose, see, commit: three days as date cards, the times grouped into
// morning and afternoon, full slots kept in place so nothing jumps. Before
// she commits, the offline note says what will happen to the booking, and a
// reservation bar reads her choice back beside the button.

import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconBuildingHospital, IconCalendarOff, IconCheck, IconCloudOff, IconSun, IconSunrise } from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { PHC, SLOTS, isoDate } from "../../app/seed";
import { shortDate, slotLabel } from "../../app/format";
import { decodeAnswers, evaluate, nextQuestion, toTriageRole } from "../../app/triage";
import Icon from "../../shell/Icon";
import { slotState } from "./slots";

const DAYS = [0, 1, 2].map((offset) => ({
  date: isoDate(offset),
  label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "Day after",
}));

const PARTS = [
  { name: "Morning", icon: IconSunrise, slots: SLOTS.filter((s) => Number(s.slice(0, 2)) < 12) },
  { name: "Afternoon", icon: IconSun, slots: SLOTS.filter((s) => Number(s.slice(0, 2)) >= 12) },
];

export default function Booking() {
  const { familyId = "", memberId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const member = family?.members.find((m) => m.id === memberId);
  const bookings = useStore((s) => s.bookings);
  const online = useStore((s) => s.online);
  const createConcern = useStore((s) => s.createConcern);
  const createBooking = useStore((s) => s.createBooking);

  const [date, setDate] = useState(DAYS[1].date);
  const [slot, setSlot] = useState<string | null>(null);

  if (!family || !member) {
    return (
      <section className="screen">
        <p className="screen__empty">Member not found.</p>
      </section>
    );
  }

  const answers = decodeAnswers(params.get("a"));
  const role = toTriageRole(member.role);

  // Booking needs a finished check behind it; otherwise the PHC would get a
  // visit with no findings. Send her back to the next question.
  if (nextQuestion(role, answers)) {
    return <Navigate to={`/asha/family/${familyId}/check/${memberId}?a=${params.get("a") ?? ""}`} replace />;
  }

  const { urgency, reasons } = evaluate(role, answers);
  const today = isoDate(0);
  const now = new Date();
  const stateOf = (s: string) => slotState(s, date, bookings, today, now);
  const nothingLeft = SLOTS.every((s) => stateOf(s) !== "open");

  // The slot she picked can fill while she is choosing (another booking
  // syncs in); never book over it.
  const chosen = slot && stateOf(slot) === "open" ? slot : null;

  const confirm = () => {
    if (!chosen) return;
    const concern = createConcern({ familyId: family.id, memberId: member.id, source: "asha", answers, urgency, reasons });
    const booking = createBooking({ concernId: concern.id, date, slot: chosen, facility: PHC.facility, doctor: PHC.doctor });
    navigate(`/asha/booked/${booking.id}`, { replace: true });
  };

  return (
    <>
      <section className="screen">
        <header className="pagehead">
          <p className="pagehead__eyebrow">
            For {member.name}, {member.age}
          </p>
          <h1 className="pagehead__title">Book a PHC visit</h1>
          <p className="pagehead__sub">
            <Icon icon={IconBuildingHospital} />
            {PHC.facility} · {PHC.doctor}
          </p>
        </header>

        <fieldset className="block">
          <legend className="block__title">Day</legend>
          <div className="days">
            {DAYS.map((d) => {
              const [dow, num] = shortDate(d.date).split(" ");
              return (
                <label key={d.date} className="daycard">
                  <input
                    className="sr-input"
                    type="radio"
                    name="day"
                    value={d.date}
                    checked={date === d.date}
                    onChange={() => {
                      setDate(d.date);
                      setSlot(null);
                    }}
                  />
                  <span className="daycard__label">{d.label}</span>
                  <span className="daycard__num">{num}</span>
                  <span className="daycard__dow">{dow}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="block">
          <legend className="block__title">Time</legend>
          {/* A day with nothing left says so, and points to another day,
              rather than leaving her to work out why nothing is tappable. */}
          {nothingLeft && (
            <p className="notice notice--strong">
              <Icon icon={IconCalendarOff} />
              <span>
                No times left {date === today ? "today" : "on this day"}. Choose another day.
              </span>
            </p>
          )}
          {PARTS.map((part) => (
            <div key={part.name} className="slots">
              <p className="slots__part">
                <Icon icon={part.icon} size={16} />
                {part.name}
              </p>
              <div className="slots__grid">
                {part.slots.map((s) => {
                  const state = stateOf(s);
                  return (
                    <label key={s} className="slot">
                      <input
                        className="sr-input"
                        type="radio"
                        name="slot"
                        value={s}
                        disabled={state !== "open"}
                        checked={chosen === s}
                        onChange={() => setSlot(s)}
                      />
                      {chosen === s && <Icon icon={IconCheck} />}
                      <span className="slot__time">{slotLabel(s)}</span>
                      {state === "full" && <span className="slot__full">Full</span>}
                      {state === "past" && <span className="slot__full">Already past</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        {!online && (
          <p className="notice">
            <Icon icon={IconCloudOff} />
            <span>You're offline. The booking is kept on this phone and sent to the PHC when there's signal.</span>
          </p>
        )}
      </section>

      {/* The choice so far, read back beside the button that commits it. */}
      <div className="reservebar">
        <p className="reservebar__summary" aria-live="polite">
          {chosen ? (
            <>
              <strong>{shortDate(date)}</strong>
              <span>
                {slotLabel(chosen)} · {PHC.facility}
              </span>
            </>
          ) : (
            <>
              <strong>Choose a time</strong>
              <span>{shortDate(date)}</span>
            </>
          )}
        </p>
        <button type="button" className="btn btn--primary" onClick={confirm} disabled={!chosen}>
          Book visit
        </button>
      </div>
    </>
  );
}
