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
      <section>
        <p>Booking not found.</p>
        <Link to="/asha">Back to today</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Visit booked</h1>
      <dl>
        <dt>Patient</dt>
        <dd>
          {member ? `${member.name}, ${member.age}` : "—"} · family {family?.id ?? "—"}
        </dd>
        <dt>Date</dt>
        <dd>{booking.date}</dd>
        <dt>Slot</dt>
        <dd>{booking.slot}</dd>
        <dt>Facility</dt>
        <dd>{booking.facility}</dd>
        <dt>Doctor</dt>
        <dd>{booking.doctor}</dd>
        <dt>Status</dt>
        <dd>{booking.sync === "sent" ? "Sent to PHC" : "Saved on phone, waiting for signal"}</dd>
      </dl>

      <h2>What to tell the family</h2>
      <ul>
        {CHECKLIST.map((item, i) => (
          <li key={item}>
            <label>
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
              />{" "}
              {item}
            </label>
          </li>
        ))}
      </ul>

      <p>
        <Link to="/asha">Back to today</Link>
      </p>
    </section>
  );
}
