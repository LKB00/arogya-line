// Confirmation with sync state and a local checklist (SPEC 6.1 Booked).

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../../app/store";

const CHECKLIST = [
  "Tell them the day and time, and to carry the family card.",
  "Bring any medicines already being taken.",
  "If it gets worse before the visit, call the doctor line.",
];

export default function Booked() {
  const { bookingId = "" } = useParams();
  const booking = useStore((s) => s.bookings.find((b) => b.id === bookingId));
  const concern = useStore((s) => s.concerns.find((c) => c.id === booking?.concernId));
  const family = useStore((s) => s.families.find((f) => f.id === concern?.familyId));
  const member = family?.members.find((m) => m.id === concern?.memberId);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  if (!booking) {
    return (
      <section className="screen">
        <p className="screen__empty">Booking not found.</p>
        <Link className="screen__back" to="/asha">
          Back to today
        </Link>
      </section>
    );
  }

  return (
    <section className="screen">
      <h1 className="screen__title">Visit booked</h1>
      <dl className="summary">
        <dt className="summary__key">Patient</dt>
        <dd className="summary__value">
          {member ? `${member.name}, ${member.age}` : "—"} · family {family?.id ?? "—"}
        </dd>
        <dt className="summary__key">Date</dt>
        <dd className="summary__value">{booking.date}</dd>
        <dt className="summary__key">Slot</dt>
        <dd className="summary__value">{booking.slot}</dd>
        <dt className="summary__key">Facility</dt>
        <dd className="summary__value">{booking.facility}</dd>
        <dt className="summary__key">Doctor</dt>
        <dd className="summary__value">{booking.doctor}</dd>
        <dt className="summary__key">Status</dt>
        <dd className="summary__value">
          <span className={booking.sync === "sent" ? "pill pill--sent" : "pill pill--waiting"}>
            {booking.sync === "sent" ? "Sent to PHC" : "Saved on phone, waiting for signal"}
          </span>
        </dd>
      </dl>

      <h2>What to tell the family</h2>
      <ul className="checklist">
        {CHECKLIST.map((item, i) => (
          <li key={item}>
            <label className="checklist__item">
              <input
                className="checklist__box"
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>

      <p className="screen__action">
        <Link className="btn btn--secondary btn--block" to="/asha">
          Back to today
        </Link>
      </p>
    </section>
  );
}
